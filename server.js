require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "expense_manager",
  waitForConnections: true,
  connectionLimit: 10,
});

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({
      error: "Login required",
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);

    next();
  } catch (error) {
    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
}

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res
        .status(400)
        .json({ error: "Name, email and password (6+ chars) are required" });
    const [exists] = await pool.query(
      "SELECT user_id FROM users WHERE email=?",
      [email],
    );
    if (exists.length)
      return res.status(409).json({ error: "Email already registered" });
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users(name,email,password) VALUES(?,?,?)",
      [name, email.toLowerCase(), hash],
    );
    const token = jwt.sign(
      { user_id: result.insertId, name, email: email.toLowerCase() },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.status(201).json({
      token,
      user: { user_id: result.insertId, name, email: email.toLowerCase() },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query("SELECT * FROM users WHERE email=?", [
      String(email).toLowerCase(),
    ]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password)))
      return res.status(401).json({ error: "Invalid email or password" });
    const u = rows[0];
    const token = jwt.sign(
      { user_id: u.user_id, name: u.name, email: u.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );
    res.json({
      token,
      user: { user_id: u.user_id, name: u.name, email: u.email },
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/me", auth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT user_id,name,email,created_at FROM users WHERE user_id=?",
    [req.user.user_id],
  );
  res.json(rows[0]);
});

app.get("/api/summary", auth, async (req, res) => {
  try {
    const id = req.user.user_id;

    const [[inc]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM income
       WHERE user_id=?`,
      [id]
    );

    const [[exp]] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id=?`,
      [id]
    );

    const income = Number(inc.total);
    const expenses = Number(exp.total);

    res.json({
      success: true,
      income: income,
      expenses: expenses,
      balance: income - expenses,
      savings: income - expenses
    });

  } catch (error) {

    console.error("SUMMARY ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/api/expenses", auth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT expense_id,category,amount,payment_method,expense_date,description FROM expenses WHERE user_id=? ORDER BY expense_date DESC,expense_id DESC",
    [req.user.user_id],
  );
  res.json(rows);
});

app.get("/api/income", auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT income_id, source, amount, income_date
       FROM income
       WHERE user_id=?
       ORDER BY income_date DESC, income_id DESC`,
      [req.user.user_id],
    );

    res.json(
      rows.map((x) => ({
        ...x,
        amount: Number(x.amount),
      })),
    );
  } catch (error) {
    console.error("GET INCOME ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/income", auth, async (req, res) => {
  try {
    const { source, amount, income_date } = req.body;

    const numericAmount = Number(amount);

    if (
      !source ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !income_date
    ) {
      return res.status(400).json({
        error: "Source, valid amount and date are required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO income
       (user_id, source, amount, income_date)
       VALUES (?, ?, ?, ?)`,
      [req.user.user_id, source, numericAmount, income_date],
    );

    res.status(201).json({
      success: true,
      message: "Income added successfully",
      income_id: result.insertId,
    });
  } catch (error) {
    console.error("INCOME CREATE ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.delete("/api/income/:id", auth, async (req, res) => {
  try {
    const [result] = await pool.query(
      `DELETE FROM income
       WHERE income_id=? AND user_id=?`,
      [req.params.id, req.user.user_id],
    );

    if (!result.affectedRows) {
      return res.status(404).json({
        error: "Income not found",
      });
    }

    res.json({
      success: true,
      message: "Income deleted",
    });
  } catch (error) {
    console.error("DELETE INCOME ERROR:", error);

    res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/expenses", auth, async (req, res) => {
  try {
    const { category, amount, payment_method, expense_date, description } =
      req.body;
    const numericAmount = Number(amount);

    if (
      !category ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !expense_date
    ) {
      return res.status(400).json({
        error: "Category, valid amount and date are required",
      });
    }

    const [result] = await pool.query(
      `INSERT INTO expenses
       (user_id, category, amount, payment_method, expense_date, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.user.user_id,
        category,
        numericAmount,
        payment_method || "Cash",
        expense_date,
        description || "",
      ],
    );

    res.status(201).json({
      success: true,
      message: "Expense added successfully",
      expense_id: result.insertId,
    });
  } catch (error) {
    console.error("EXPENSE CREATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/expenses/:id", auth, async (req, res) => {
  try {
    const { category, amount, payment_method, expense_date, description } =
      req.body;
    const numericAmount = Number(amount);

    if (
      !category ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !expense_date
    ) {
      return res.status(400).json({
        error: "Category, valid amount and date are required",
      });
    }

    const [result] = await pool.query(
      `UPDATE expenses
       SET category=?, amount=?, payment_method=?, expense_date=?, description=?
       WHERE expense_id=? AND user_id=?`,
      [
        category,
        numericAmount,
        payment_method || "Cash",
        expense_date,
        description || "",
        req.params.id,
        req.user.user_id,
      ],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ success: true, message: "Expense updated" });
  } catch (error) {
    console.error("EXPENSE UPDATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/expenses/:id", auth, async (req, res) => {
  try {
    const [result] = await pool.query(
      "DELETE FROM expenses WHERE expense_id=? AND user_id=?",
      [req.params.id, req.user.user_id],
    );

    if (!result.affectedRows) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json({ success: true, message: "Expense deleted" });
  } catch (error) {
    console.error("EXPENSE DELETE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/budgets", auth, async (req, res) => {
  try {
    const { category, limit_amount, month } = req.body;
    const numericLimit = Number(limit_amount);

    if (
      !category ||
      !Number.isFinite(numericLimit) ||
      numericLimit <= 0 ||
      !month
    ) {
      return res.status(400).json({
        error: "Category, valid limit amount and month are required",
      });
    }

    await pool.query(
      `INSERT INTO budgets(user_id, category, limit_amount, month)
       VALUES(?,?,?,?)
       ON DUPLICATE KEY UPDATE limit_amount=VALUES(limit_amount)`,
      [req.user.user_id, category, numericLimit, month],
    );

    res
      .status(201)
      .json({ success: true, message: "Budget saved successfully" });
  } catch (error) {
    console.error("BUDGET ERROR:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/budgets", auth, async (req, res) => {
  const id = req.user.user_id;
  const [rows] = await pool.query(
    `SELECT b.budget_id,b.category,b.limit_amount,b.month,
      COALESCE(SUM(e.amount),0) spent
     FROM budgets b
     LEFT JOIN expenses e ON e.user_id=b.user_id AND e.category=b.category
       AND DATE_FORMAT(e.expense_date,'%Y-%m')=b.month
     WHERE b.user_id=? GROUP BY b.budget_id ORDER BY b.category`,
    [id],
  );
  res.json(
    rows.map((x) => ({
      ...x,
      spent: Number(x.spent),
      limit_amount: Number(x.limit_amount),
      percentage: x.limit_amount
        ? Math.round((Number(x.spent) / Number(x.limit_amount)) * 100)
        : 0,
    })),
  );
});

app.delete("/api/budgets/:id", auth, async (req, res) => {
  await pool.query("DELETE FROM budgets WHERE budget_id=? AND user_id=?", [
    req.params.id,
    req.user.user_id,
  ]);
  res.json({ message: "Budget deleted" });
});

app.get("/api/categories", auth, async (req, res) => {
  const [rows] = await pool.query(
    "SELECT category,SUM(amount) total FROM expenses WHERE user_id=? GROUP BY category ORDER BY total DESC",
    [req.user.user_id],
  );
  res.json(rows.map((x) => ({ category: x.category, total: Number(x.total) })));
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () =>
  console.log(`Smart Expense Manager: http://localhost:${PORT}`),
);
