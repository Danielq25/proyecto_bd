import { plainToClass } from "class-transformer";
import { validateOrReject } from "class-validator";
import dotenv from "dotenv";
import "es6-shim";
import express, { Express, Request, Response } from "express";
import { Pool } from "pg";
import "reflect-metadata";
import { Board } from "./dto/board.dto";
import { User } from "./dto/user.dto";
import { List } from "./dto/list.dto";
import { Card } from "./dto/card.dto";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: +process.env.DB_PORT!,
});

const app: Express = express();
const port = process.env.PORT || 3000;
app.use(express.json());

app.get("/users", async (req: Request, res: Response) => {
  try {
    const text = "SELECT id, name, email FROM users";
    const result = await pool.query(text);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/users", async (req: Request, res: Response) => {
  let userDto: User = plainToClass(User, req.body);
  try {
    await validateOrReject(userDto);

    const text = "INSERT INTO users(name, email) VALUES($1, $2) RETURNING *";
    const values = [userDto.name, userDto.email];
    const result = await pool.query(text, values);
    res.status(201).json(result.rows[0]);
  } catch (errors) {
    return res.status(422).json(errors);
  }
});

app.get("/boards", async (req: Request, res: Response) => {
  try {
    const text =
      'SELECT b.id, b.name, bu.userId "adminUserId" FROM boards b JOIN board_users bu ON bu.boardId = b.id WHERE bu.isAdmin IS true';
    const result = await pool.query(text);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/boards", async (req: Request, res: Response) => {
  let boardDto: Board = plainToClass(Board, req.body);
  const client = await pool.connect();
  try {
    client.query("BEGIN");
    await validateOrReject(boardDto, {});

    const boardText = "INSERT INTO boards(name) VALUES($1) RETURNING *";
    const boardValues = [boardDto.name];
    const boardResult = await client.query(boardText, boardValues);

    const boardUserText =
      "INSERT INTO board_users(boardId, userId, isAdmin) VALUES($1, $2, $3)";
    const boardUserValues = [
      boardResult.rows[0].id,
      boardDto.adminUserId,
      true,
    ];
    await client.query(boardUserText, boardUserValues);

    client.query("COMMIT");
    res.status(201).json(boardResult.rows[0]);
  } catch (errors) {
    client.query("ROLLBACK");
    return res.status(422).json(errors);
  } finally {
    client.release();
  }
});

app.get("/boards/:boardId/lists", async (req: Request, res: Response) => {
  try {
    const boardId = req.params.boardId;
    const text = "SELECT id, name FROM lists WHERE boardId = $1";
    const result = await pool.query(text, [boardId]);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/lists", async (req: Request, res: Response) => {
  const listDto: List = plainToClass(List, req.body);
  try {
    await validateOrReject(listDto);
    const text = "INSERT INTO lists(name, boardId) VALUES($1, $2) RETURNING *";
    const result = await pool.query(text, [listDto.name, listDto.boardId]);
    res.status(201).json(result.rows[0]);
  } catch (errors) {
    return res.status(422).json(errors);
  }
});

app.post("/cards", async (req: Request, res: Response) => {
  const cardDto: Card = plainToClass(Card, req.body);
  const client = await pool.connect();
  try {
    client.query("BEGIN");

    let text = "SELECT id FROM users WHERE id = $1";
    const usersResult = await client.query(text, [cardDto.userId]);

    if (usersResult.rows.length == 0) {
      return res.status(422).json({ message: "The user don't exist" });
    }

    await validateOrReject(cardDto);

    text =
      "INSERT INTO cards(title, description, dueDate, listId) VALUES($1, $2, $3, $4) RETURNING *";
    let values = [
      cardDto.title,
      cardDto.description,
      cardDto.dueDate,
      cardDto.listId,
    ];
    const cardResult = await client.query(text, values);

    text =
      "INSERT INTO card_users(cardId, userId, isOwner) VALUES($1, $2, $3) RETURNING *";
    values = [cardResult.rows[0].id, cardDto.userId, true];
    await client.query(text, values);

    client.query("COMMIT");
    res.status(201).json(cardResult.rows[0]);
  } catch (errors: any) {
    if (errors.code == 23505) {
      return res
        .status(422)
        .json({ message: "This user has already been assigned to this card" });
    }
    client.query("ROLLBACK");
    return res.status(422).json(errors);
  } finally {
    client.release();
  }
});

app.get("/cards", async (req: Request, res: Response) => {
  try {
    const text = "SELECT id, title FROM cards";
    const result = await pool.query(text);
    res.status(200).json(result.rows);
  } catch (errors) {
    return res.status(400).json(errors);
  }
});

app.post("/cards/:cardId/assign-user", async (req: Request, res: Response) => {
  try {
    const cardId = req.params.cardId;
    const userId = req.body.userId;

    let text = "SELECT COUNT(id) FROM users WHERE id = $1";

    let result = await pool.query(text, [userId]);

    if (result.rows[0].count == 0) {
      return res.status(422).json({ message: "The user don't exist" });
    }

    text = "INSERT INTO card_users(cardId, userId) VALUES($1, $2) RETURNING *";
    const values = [cardId, userId];
    result = await pool.query(text, values);
    res.status(201).json(result.rows[0]);
  } catch (errors: any) {
    if (errors.code == 23505) {
      return res
        .status(422)
        .json({ message: "This user has already been assigned to this card" });
    }
    return res.status(422).json(errors);
  }
});

app.get("/cards/:cardId", async (req: Request, res: Response) => {
  try {
    const cardId = req.params.cardId;
    const text = `SELECT cards.id, cards.title, users.name as owner_name FROM cards
                    INNER JOIN card_users ON cards.id = card_users.cardId
                    INNER JOIN users ON card_users.userId = users.id
                    WHERE card_users.isOwner IS True AND cards.id = $1`;
    const values = [cardId];
    const result = await pool.query(text, values);
    res.status(201).json(result.rows);
  } catch (errors) {
    console.log(errors);
    return res.status(422).json(errors);
  }
});

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
