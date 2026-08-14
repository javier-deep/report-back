const express = require('express');
const Proyecto = require('../models/Proyecto');

const router = express.Router();

router.get('/pendientes/:tecnicoId', async (req, res) => {
  try {
    const { tecnicoId } = req.params;

    const proyectos = await Proyecto.find({
      tecnicoAsignado: tecnicoId,
      estado: { $in: ['Pendiente', 'Recibido', 'Revisado'] },
    }).sort({ proyectoId: 1 });

    return res.json({
      ok: true,
      count: proyectos.length,
      data: proyectos.map((proyecto) => ({
        proyectoId: proyecto.proyectoId,
        nombreCliente: proyecto.nombreCliente,
        direccion: proyecto.direccion,
        tecnicoAsignado: proyecto.tecnicoAsignado,
        estado: proyecto.estado,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al listar proyectos pendientes', error: error.message });
  }
});

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

router.post('/', async (req, res) => {
  try {
    const { proyectoId, nombreCliente, direccion, tecnicoAsignado } = req.body || {};

    if (!proyectoId || !nombreCliente || !direccion || !tecnicoAsignado) {
      return res.status(400).json({
        message: 'Se requieren proyectoId, nombreCliente, direccion y tecnicoAsignado',
      });
    }

    const existente = await Proyecto.findOne({ proyectoId });
    if (existente) {
      return res.status(409).json({
        message: 'El proyectoId ya existe',
      });
    }

    const proyecto = await Proyecto.create({
      proyectoId,
      nombreCliente,
      direccion,
      tecnicoAsignado,
      estado: 'Pendiente',
    });

    return res.status(201).json({
      ok: true,
      message: 'Proyecto creado correctamente',
      data: proyecto,
    });
  } catch (error) {
    return res.status(400).json({ message: 'Error al crear proyecto', error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const proyectos = await Proyecto.find().sort({ proyectoId: 1 });

    return res.json({
      ok: true,
      count: proyectos.length,
      data: proyectos,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al listar proyectos', error: error.message });
  }
});

module.exports = router;
