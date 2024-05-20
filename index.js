const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const { request } = require("http");

const app = express();

app.use(express.json());
app.use(cors());

const dbPath = path.join(__dirname, "sample.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const AuthenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    console.log(jwtToken);
  }

  if (jwtToken === undefined) {
    response.status(401).send("Invalid Token");
  } else {
    jwt.verify(jwtToken, "SECRET", (error, payload) => {
      if (error) {
        response.status(401).send("Invalid Token");
      } else {
        request.payload = payload;
        next();
      }
    });
  }
};

// Register API
app.post("/register/", async (request, response) => {
  const { name, password, username } = request.body;
  const getUserQuery = `
  SELECT * FROM user WHERE username='${username}';
  `;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const addUserQuery = `
    INSERT INTO user (username, name, password)
    VALUES 
        ('${username}', '${name}', '${hashedPassword}');
    `;
    const dbResponse = await db.run(addUserQuery);
    const id = dbResponse.lastID;
    response.send({ id, message: "User Created Successfully" });
  } else {
    response.status(400).send("User Already Exists");
  }
});

// Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `
  SELECT * FROM user WHERE username='${username}';
  `;
  const dbUser = await db.get(getUserQuery);

  if (dbUser === undefined) {
    response.status(400).send({ message: "Invalid User" });
  } else {
    const isVaidPassword = await bcrypt.compare(password, dbUser.password);

    if (isVaidPassword === true) {
      const jwtToken = jwt.sign(dbUser, "SECRET");
      response.send({ jwtToken, message: "Login Successful" });
    } else {
      response.status(400).send({ message: "Invalid Password" });
    }
  }
});

// GET BOOKS API
app.get("/books/", AuthenticateToken, async (request, response) => {
  const { search_q = "", order = "ASC", order_by = "book_id" } = request.query;
  const getBooksQuery = `
    SELECT * FROM books 
    WHERE 
        name LIKE '%${search_q}%'
    ORDER BY
     ${order_by} ${order}
    ;
    `;
  const booksArray = await db.all(getBooksQuery);
  response.send(booksArray);
});

// Add book API
app.post("/books/", AuthenticateToken, async (request, response) => {
  const { name, category } = request.body;
  const addBookQuery = `
  INSERT INTO books (name, category)
  VALUES ('${name}', '${category}');
  `;
  const dbResponse = await db.run(addBookQuery);
  response.send({ message: `Book Added with id ${dbResponse.lastID}` });
});

// Update Books API
app.put("/books/:id", AuthenticateToken, async (request, response) => {
  const { id } = request.params;
  const getBookQuery = `
  SELECT * FROM books WHERE book_id=${id};
  `;
  const book = await db.get(getBookQuery);

  const { name = book.name, category = book.category } = request.body;

  const updateBookQuery = `
    UPDATE books
    SET 
        name='${name}',
        category='${category}'
    WHERE 
        book_id=${id}
    `;
  await db.run(updateBookQuery);
  response.send({ message: "Books details Updated Successfully" });
});

// GET users API
app.get("/users/", AuthenticateToken, async (request, response) => {
  const getUsersQuery = `
    SELECT * FROM user;
    `;
  const usersArr = await db.all(getUsersQuery);
  response.send(usersArr);
});
