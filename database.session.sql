USE expense_manager;

-- SELECT user_id, name, email
-- FROM users;

-- SELECT income_id, user_id, source, amount
-- FROM income;

-- SELECT DISTINCT i.user_id
-- FROM income i
-- LEFT JOIN users u
--     ON i.user_id = u.user_id
-- WHERE u.user_id IS NULL;

-- SELECT *
-- FROM users
-- WHERE user_id = 5;

-- UPDATE income i
-- LEFT JOIN users u
--     ON i.user_id = u.user_id
-- SET i.user_id = 5
-- WHERE u.user_id IS NULL;

-- SELECT income_id, user_id, source, amount
-- FROM income;


-- ALTER TABLE income
-- ADD CONSTRAINT fk_income_user
-- FOREIGN KEY (user_id)
-- REFERENCES users(user_id)
-- ON DELETE CASCADE;

SELECT user_id, name, email
FROM users;