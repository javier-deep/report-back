require('dotenv').config({ override: true });

const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const reportesRoutes = require('./routes/reportes');
const proyectosRoutes = require('./routes/proyectos');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Backend de reportes fotovoltaicos activo' });
});

app.use('/api/auth', authRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/reportes', reportesRoutes);

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
};

startServer();
