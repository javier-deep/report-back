const express = require('express');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

const tecnicosAutorizados = [
  {
    tecnicoId: 'TEC-001',
    password: '123456',
    nombre: 'Gerardo Morales',
  },
  {
    tecnicoId: 'TEC-002',
    password: 'admin123',
    nombre: 'Técnico 2',
  },
];

router.post('/login', (req, res) => {
  const { tecnicoId, password } = req.body || {};

  if (!tecnicoId || !password) {
    return res.status(400).json({ message: 'Se requieren tecnicoId y password' });
  }

  const tecnico = tecnicosAutorizados.find(
    (item) => item.tecnicoId === tecnicoId && item.password === password
  );

  if (!tecnico) {
    return res.status(401).json({ message: 'Credenciales inválidas' });
  }

  const token = generateToken({ tecnicoId: tecnico.tecnicoId, nombre: tecnico.nombre });

  return res.json({
    message: 'Autenticación exitosa',
    token,
    tecnico: {
      tecnicoId: tecnico.tecnicoId,
      nombre: tecnico.nombre,
    },
  });
});

module.exports = router;
