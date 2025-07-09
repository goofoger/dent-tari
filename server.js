const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ініціалізація бази даних для записів на прийом
const dbAppointments = new sqlite3.Database('./appointments.db', (err) => {
    if (err) {
        console.error('Помилка відкриття бази даних записів на прийом:', err.message);
    } else {
        console.log('Підключено до бази даних записів на прийом.');
        dbAppointments.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
            if (createErr) {
                console.error('Помилка створення таблиці appointments:', createErr.message);
            }
        });
    }
});

// Ініціалізація бази даних для відгуків
const dbReviews = new sqlite3.Database('./reviews.db', (err) => {
    if (err) {
        console.error('Помилка відкриття бази даних відгуків:', err.message);
    } else {
        console.log('Підключено до бази даних відгуків.');
        dbReviews.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (createErr) => {
            if (createErr) {
                console.error('Помилка створення таблиці reviews:', createErr.message);
            }
        });
    }
});

// Маршрут для обслуговування admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Маршрут для отримання всіх записів на прийом для адмін-панелі (з пошуком)
app.get('/api/admin/appointments', (req, res) => {
    const searchTerm = req.query.search;
    let sql = `SELECT id, name, phone, email, message, timestamp FROM appointments`;
    let params = [];

    if (searchTerm) {
        sql += ` WHERE name LIKE ? OR phone LIKE ?`;
        params = [`%${searchTerm}%`, `%${searchTerm}%`];
    }
    sql += ` ORDER BY timestamp DESC`;

    dbAppointments.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Помилка отримання записів для адмін-панелі:', err.message);
            return res.status(500).json({ error: 'Помилка сервера при отриманні записів.' });
        }
        res.status(200).json(rows);
    });
});

// Маршрут для видалення запису на прийом за ID
app.delete('/api/admin/appointments/:id', (req, res) => {
    const appointmentId = req.params.id;
    const sql = `DELETE FROM appointments WHERE id = ?`;
    dbAppointments.run(sql, appointmentId, function (err) {
        if (err) {
            console.error('Помилка видалення запису:', err.message);
            return res.status(500).json({ error: 'Не вдалося видалити запис.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Запис не знайдено.' });
        }
        res.status(200).json({ message: 'Запис успішно видалено.' });
    });
});

// Маршрут для отримання всіх записів на прийом
app.post('/api/appointments', (req, res) => {
    const { name, phone, email, message } = req.body;

    if (!name || !phone || !email) {
        return res.status(400).json({ error: 'Ім\'я, телефон та електронна пошта обов\'язкові.' });
    }

    const sql = `INSERT INTO appointments (name, phone, email, message) VALUES (?, ?, ?, ?)`;
    dbAppointments.run(sql, [name, phone, email, message], function (err) {
        if (err) {
            console.error('Помилка вставки запису на прийом:', err.message);
            return res.status(500).json({ error: 'Не вдалося забронювати запис на прийом.' });
        }
        res.status(201).json({ message: 'Запис на прийом успішно заброньовано!', id: this.lastID });
    });
});

// НОВІ МАРШРУТИ ДЛЯ КЕРУВАННЯ ВІДГУКАМИ (АДМІН-ПАНЕЛЬ)
// Маршрут для отримання всіх відгуків для адмін-панелі
app.get('/api/admin/reviews', (req, res) => {
    const sql = `SELECT id, author, content, timestamp FROM reviews ORDER BY timestamp DESC`;
    dbReviews.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Помилка отримання відгуків для адмін-панелі:', err.message);
            return res.status(500).json({ error: 'Помилка сервера при отриманні відгуків.' });
        }
        res.status(200).json(rows);
    });
});

// Маршрут для видалення відгуку за ID
app.delete('/api/admin/reviews/:id', (req, res) => {
    const reviewId = req.params.id;
    const sql = `DELETE FROM reviews WHERE id = ?`;
    dbReviews.run(sql, reviewId, function (err) {
        if (err) {
            console.error('Помилка видалення відгуку:', err.message);
            return res.status(500).json({ error: 'Не вдалося видалити відгук.' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Відгук не знайдено.' });
        }
        res.status(200).json({ message: 'Відгук успішно видалено.' });
    });
});
// КІНЕЦЬ НОВИХ МАРШРУТІВ ДЛЯ КЕРУВАННЯ ВІДГУКАМИ

// Маршрут для отримання всіх відгуків (для головної сторінки)
app.get('/api/reviews', (req, res) => {
    const sql = `SELECT id, author, content, timestamp FROM reviews ORDER BY timestamp DESC`;
    dbReviews.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Помилка отримання відгуків:', err.message);
            return res.status(500).json({ error: 'Не вдалося отримати відгуки.' });
        }
        res.status(200).json(rows);
    });
});

// Маршрут для створення нового відгуку
app.post('/api/reviews', (req, res) => {
    const { author, content } = req.body;

    if (!author || !content) {
        return res.status(400).json({ error: 'Автор та зміст відгуку обов\'язкові.' });
    }

    const sql = `INSERT INTO reviews (author, content) VALUES (?, ?)`;
    dbReviews.run(sql, [author, content], function (err) {
        if (err) {
            console.error('Помилка вставки відгуку:', err.message);
            return res.status(500).json({ error: 'Не вдалося додати відгук.' });
        }
        res.status(201).json({ message: 'Відгук успішно додано!', id: this.lastID });
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущено на http://localhost:${PORT}`);
});