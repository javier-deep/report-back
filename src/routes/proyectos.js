const express = require('express');
const Proyecto = require('../models/Proyecto');

const router = express.Router();

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const proyecto = await Proyecto.findOne({ proyectoId: id }).lean();

    if (!proyecto) {
      return res.status(404).json({
        message: 'Proyecto no encontrado',
        proyectoId: id,
      });
    }

    return res.json({
      ok: true,
      data: {
        proyectoId: proyecto.proyectoId,
        nombreCliente: proyecto.nombreCliente,
        direccion: proyecto.direccion,
        telefono: proyecto.telefono,
        tecnicoAsignado: proyecto.tecnicoAsignado,
        estado: proyecto.estado,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al validar proyecto', error: error.message });
  }
});

module.exports = router;
