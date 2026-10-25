# Budget-manager-Expence-Tracker
Smart Expense & Budget Manager

A web-based application for managing personal income, expenses, monthly
budgets, and spending reports. Users can create an account, record
transactions, monitor budget usage, and review financial summaries from
a dashboard.

  Features
- User registration and login
- Password hashing with bcryptjs
- Token-based authentication using JSON Web Tokens (JWT)
- Add income sources and amounts
- Add, edit, search, and delete expenses
- Categorize expenses and record payment methods
- Create and delete monthly category budgets
- Dashboard summary for total income, expenses, balance, and savings
- Charts and expense insights using Chart.js
- Responsive interface with a dark-mode toggle
- MySQL database storage
  
  Technology Stack
- Frontend: HTML, CSS, JavaScript
- Charts: Chart.js
- Backend: Node.js, Express
- Database: MySQL
- Authentication: bcryptjs and JSON Web Tokens
- Database driver: mysql2
- Other packages: dotenv, cors

Project Structure
 smart-expense-budget-manager/
 ├── public/
 │   ├── index.html
 │   ├── style.css
 │   ├── app.js
 │   └── pagelayout.png
 ├── server.js
 ├── database.sql
 ├── package.json
 ├── package-lock.json
 ├── .env
 └── README.md
 
Keep the frontend files and image inside the public directory because
the Express server serves static files from public.
Prerequisites

 Install the following before running the project:
 - Node.js (version 18 or later recommended)
 - npm
 - MySQL Server
 - A code editor such as Visual Studio Code
   
Setup and Installation
1. Clone or download the project->
  Open the project folder in VS Code and open a terminal in that folder.
2. Install dependencies->
  npm install
  On Windows PowerShell, if the npm command is blocked by the execution
  policy, try:
  npm.cmd install
3. Create the database
  Open MySQL Workbench or the MySQL command-line client and run the SQL
  script supplied with the project:
  SOURCE path/to/database.sql;
  Alternatively, open database.sql in MySQL Workbench and execute it.
  The script creates the expense_manager database and the users,
  income, expenses, and budgets tables.
4. Configure environment variables
  Create a .env file in the project root. Use the following template and
  replace the example values with your own local configuration:
  DB_HOST=localhost
  DB_USER=root
  DB_PASSWORD=your_mysql_password
  DB_NAME=expense_manager
  JWT_SECRET=replace_with_a_long_random_secret
  PORT=3000
  Do not commit .env to GitHub. Keep database passwords and JWT secrets
  private. If a real password has already been uploaded or committed
  publicly, change it in MySQL and update your local configuration.
5. Start the server
  npm start
  Or run the server directly:
  node server.js
  If the server starts successfully, open:
  http://localhost:3000
 How to Use
1. Open the application in your browser.
2. Register a new account or log in.
3. Add income from the Transactions section.
4. Add expenses with a category, amount, date, payment method, and
   description.
5. Create monthly budgets from the Budgets section.
6. Review your balance, income, expenses, savings, and budget progress
   on the dashboard.
7. Open Reports to view expense charts and insights.
8. Use Settings to access account details and toggle the
   appearance.
