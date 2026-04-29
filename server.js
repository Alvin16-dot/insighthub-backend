const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4040;

app.use(express.json());
app.use(cors('*'));


// Create tables
const createTables = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'student',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                abstract TEXT NOT NULL,
                department VARCHAR(100) NOT NULL,
                supervisor VARCHAR(100) NOT NULL,
                year INTEGER NOT NULL,
                tags VARCHAR(255),
                technology VARCHAR(255),
                file_url VARCHAR(255),
                video_url VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending',
                user_id INTEGER REFERENCES users(id),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS bookmarks (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                project_id INTEGER REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS comments (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                user_id INTEGER REFERENCES users(id),
                project_id INTEGER REFERENCES projects(id),
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log('Tables ready!');
    } catch (error) {
        console.log('Table error:', error.message);
    }
};

createTables();

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        // We use bcrypt.hash to scramble the password before saving it.
        // This is for security because even if the database is leaked, 
        // hackers can't see the actual user passwords.
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, role',
            [name, email, hashedPassword]
        );
        res.json({ message: 'Registered successfully', user: result.rows[0] });
    } catch (error) {
        res.status(400).json({ error: 'Email already exists' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) return res.status(400).json({ error: 'User not found' });

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid password' });

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
        res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(401).json({ error: 'Access denied' });
    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);
        req.user = verified;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
};


app.get('/api/projects', async (req, res) => {
    try {
        const { department, year, keyword } = req.query;
        let query = `SELECT projects.*, users.name as student_name 
                     FROM projects JOIN users ON projects.user_id = users.id 
                     WHERE projects.status = 'approved'`;
        let params = [];

        if (department) { params.push(department); query += ` AND department = $${params.length}`; }
        if (year) { params.push(year); query += ` AND year = $${params.length}`; }
        if (keyword) { params.push(`%${keyword}%`); query += ` AND (title ILIKE $${params.length} OR tags ILIKE $${params.length} OR technology ILIKE $${params.length})`; }

        query += ' ORDER BY projects.created_at DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/api/projects/:id', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT projects.*, users.name as student_name 
             FROM projects JOIN users ON projects.user_id = users.id 
             WHERE projects.id = $1`,
            [req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


app.post('/api/projects', authenticateToken, async (req, res) => {
    const { title, abstract, department, supervisor, year, tags, technology, file_url, video_url } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO projects (title, abstract, department, supervisor, year, tags, technology, file_url, video_url, user_id) 
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [title, abstract, department, supervisor, year, tags, technology, file_url, video_url, req.user.id]
        );
        res.json({ message: 'Project submitted!', project: result.rows[0] });
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});



app.post('/api/bookmarks/:projectId', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'INSERT INTO bookmarks (user_id, project_id) VALUES ($1, $2)',
            [req.user.id, req.params.projectId]
        );
        res.json({ message: 'Bookmarked!' });
    } 
    catch (error) {
        res.status(500).json({ error: 'Already bookmarked' });
    }
});

app.get('/api/bookmarks', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT projects.*, users.name as student_name FROM bookmarks
             JOIN projects ON bookmarks.project_id = projects.id
             JOIN users ON projects.user_id = users.id
             WHERE bookmarks.user_id = $1`,
            [req.user.id]
        );
        res.json(result.rows);
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


app.post('/api/comments/:projectId', authenticateToken, async (req, res) => {
    const { content } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO comments (content, user_id, project_id) VALUES ($1, $2, $3) RETURNING *`,
            [content, req.user.id, req.params.projectId]
        );
        res.json(result.rows[0]);
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/comments/:projectId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT comments.*, users.name FROM comments
             JOIN users ON comments.user_id = users.id
             WHERE project_id = $1 ORDER BY comments.created_at DESC`,
            [req.params.projectId]
        );
        res.json(result.rows);
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/api/admin/projects', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        const result = await pool.query(
            `SELECT projects.*, users.name as student_name FROM projects
             JOIN users ON projects.user_id = users.id
             ORDER BY projects.created_at DESC`
        );
        res.json(result.rows);
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.put('/api/admin/projects/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { status } = req.body;
    try {
        await pool.query('UPDATE projects SET status = $1 WHERE id = $2', [status, req.params.id]);
        res.json({ message: `Project ${status}!` });
    } 
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/admin/projects/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM comments WHERE project_id = $1', [req.params.id]);
        await pool.query('DELETE FROM bookmarks WHERE project_id = $1', [req.params.id]);
        await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
        res.json({ message: 'Project deleted' });
    } 
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({ message: 'InsightHub API is running!' });
});

app.listen(PORT, () => {       
    console.log(`Server is running on http://localhost:${PORT}`);
});

