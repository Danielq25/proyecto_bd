"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dotenv_1 = __importDefault(require("dotenv"));
require("es6-shim");
const express_1 = __importDefault(require("express"));
const pg_1 = require("pg");
require("reflect-metadata");
const board_dto_1 = require("./dto/board.dto");
const user_dto_1 = require("./dto/user.dto");
const list_dto_1 = require("./dto/list.dto");
const card_dto_1 = require("./dto/card.dto");
dotenv_1.default.config();
const pool = new pg_1.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASS,
    port: +process.env.DB_PORT,
});
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
app.use(express_1.default.json());
app.get("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const text = "SELECT id, name, email FROM users";
        const result = yield pool.query(text);
        res.status(200).json(result.rows);
    }
    catch (errors) {
        return res.status(400).json(errors);
    }
}));
app.post("/users", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let userDto = (0, class_transformer_1.plainToClass)(user_dto_1.User, req.body);
    try {
        yield (0, class_validator_1.validateOrReject)(userDto);
        const text = "INSERT INTO users(name, email) VALUES($1, $2) RETURNING *";
        const values = [userDto.name, userDto.email];
        const result = yield pool.query(text, values);
        res.status(201).json(result.rows[0]);
    }
    catch (errors) {
        return res.status(422).json(errors);
    }
}));
app.get("/boards", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const text = 'SELECT b.id, b.name, bu.userId "adminUserId" FROM boards b JOIN board_users bu ON bu.boardId = b.id WHERE bu.isAdmin IS true';
        const result = yield pool.query(text);
        res.status(200).json(result.rows);
    }
    catch (errors) {
        return res.status(400).json(errors);
    }
}));
app.post("/boards", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let boardDto = (0, class_transformer_1.plainToClass)(board_dto_1.Board, req.body);
    const client = yield pool.connect();
    try {
        client.query("BEGIN");
        yield (0, class_validator_1.validateOrReject)(boardDto, {});
        const boardText = "INSERT INTO boards(name) VALUES($1) RETURNING *";
        const boardValues = [boardDto.name];
        const boardResult = yield client.query(boardText, boardValues);
        const boardUserText = "INSERT INTO board_users(boardId, userId, isAdmin) VALUES($1, $2, $3)";
        const boardUserValues = [
            boardResult.rows[0].id,
            boardDto.adminUserId,
            true,
        ];
        yield client.query(boardUserText, boardUserValues);
        client.query("COMMIT");
        res.status(201).json(boardResult.rows[0]);
    }
    catch (errors) {
        client.query("ROLLBACK");
        return res.status(422).json(errors);
    }
    finally {
        client.release();
    }
}));
app.get("/boards/:boardId/lists", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const boardId = req.params.boardId;
        const text = "SELECT id, name FROM lists WHERE boardId = $1";
        const result = yield pool.query(text, [boardId]);
        res.status(200).json(result.rows);
    }
    catch (errors) {
        return res.status(400).json(errors);
    }
}));
app.post("/lists", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const listDto = (0, class_transformer_1.plainToClass)(list_dto_1.List, req.body);
    try {
        yield (0, class_validator_1.validateOrReject)(listDto);
        const text = "INSERT INTO lists(name, boardId) VALUES($1, $2) RETURNING *";
        const result = yield pool.query(text, [listDto.name, listDto.boardId]);
        res.status(201).json(result.rows[0]);
    }
    catch (errors) {
        return res.status(422).json(errors);
    }
}));
app.post("/cards", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const cardDto = (0, class_transformer_1.plainToClass)(card_dto_1.Card, req.body);
    try {
        yield (0, class_validator_1.validateOrReject)(cardDto);
        const text = "INSERT INTO cards(title, description, dueDate, listId) VALUES($1, $2, $3, $4) RETURNING *";
        const values = [
            cardDto.title,
            cardDto.description,
            cardDto.dueDate,
            cardDto.listId,
        ];
        const result = yield pool.query(text, values);
        res.status(201).json(result.rows[0]);
    }
    catch (errors) {
        return res.status(422).json(errors);
    }
}));
app.get("/cards", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const text = "SELECT id, title FROM cards";
        const result = yield pool.query(text);
        res.status(200).json(result.rows);
    }
    catch (errors) {
        return res.status(400).json(errors);
    }
}));
app.post("/cards/:cardId/assign-user", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cardId = req.params.cardId;
        const userId = req.body.userId;
        let text = "SELECT COUNT(id) FROM board_users WHERE userId = $1";
        let result = yield pool.query(text, [userId]);
        if (result.rows[0].count == 0) {
            return res
                .status(422)
                .json({ message: "The user don't exist into the board" });
        }
        text = "INSERT INTO card_users(cardId, userId) VALUES($1, $2) RETURNING *";
        const values = [cardId, userId];
        result = yield pool.query(text, values);
        res.status(201).json(result.rows[0]);
    }
    catch (errors) {
        return res.status(422).json(errors);
    }
}));
app.get("/cards/:cardId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const cardId = req.params.cardId;
        const text = `SELECT cards.id, cards.title, users.name as owner_name FROM cards
                    INNER JOIN lists ON lists.id = cards.listId 
                    INNER JOIN board_users ON lists.boardId = board_users.boardId
                    INNER JOIN users ON users.id = board_users.userId
                    WHERE board_users.isAdmin IS True AND cards.id = $1`;
        const values = [cardId];
        const result = yield pool.query(text, values);
        res.status(201).json(result.rows);
    }
    catch (errors) {
        console.log(errors);
        return res.status(422).json(errors);
    }
}));
app.listen(port, () => {
    console.log(`[server]: Server is running at http://localhost:${port}`);
});
