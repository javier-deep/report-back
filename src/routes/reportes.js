const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const Reporte = require('../models/Reporte');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname) || '.jpg';
    const cleanName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_.-]/g, '');
    cb(null, `${timestamp}_${cleanName || 'imagen'}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { files: 8, fileSize: 10 * 1024 * 1024 },
});

const allowedKeys = [
  'ESTRUCTURA_FIJACION',
  'PANELES_ETIQUETA',
  'INVERSORES_ETIQUETA',
  'DUCTERIA',
  'PROTECCIONES_CD_CA',
  'MEDICIONES_VOLTAJE',
  'PUESTA_TIERRA',
  'ENTORNO_MEDIDOR',
];

router.get('/', async (req, res) => {
  try {
    const reportes = await Reporte.find().sort({ fechaCreacion: -1 });
    res.json(reportes);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar reportes', error: error.message });
  }
});

router.post('/enviar', authRequired, upload.fields(allowedKeys.map((key) => ({ name: key, maxCount: 1 }))), async (req, res) => {
  try {
    const { datos } = req.body;

    if (!datos) {
      return res.status(400).json({ message: 'El campo datos es obligatorio' });
    }

    let payload;

    try {
      payload = JSON.parse(datos);
    } catch (_error) {
      return res.status(400).json({ message: 'El campo datos debe ser un JSON válido' });
    }

    const uploadedFiles = {};
    for (const key of allowedKeys) {
      const file = req.files?.[key]?.[0];
      if (file) {
        uploadedFiles[key] = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      }
    }

    const evidenciaFotografica = {
      estructuraFijacion: uploadedFiles.ESTRUCTURA_FIJACION || payload?.evidenciaFotografica?.estructuraFijacion || '',
      panelesEtiqueta: uploadedFiles.PANELES_ETIQUETA || payload?.evidenciaFotografica?.panelesEtiqueta || '',
      inversoresEtiqueta: uploadedFiles.INVERSORES_ETIQUETA || payload?.evidenciaFotografica?.inversoresEtiqueta || '',
      ducteria: uploadedFiles.DUCTERIA || payload?.evidenciaFotografica?.ducteria || '',
      proteccionesCDCA: uploadedFiles.PROTECCIONES_CD_CA || payload?.evidenciaFotografica?.proteccionesCDCA || '',
      medicionesVoltaje: uploadedFiles.MEDICIONES_VOLTAJE || payload?.evidenciaFotografica?.medicionesVoltaje || '',
      puestaATerra: uploadedFiles.PUESTA_TIERRA || payload?.evidenciaFotografica?.puestaATerra || '',
      entornoMedidor: uploadedFiles.ENTORNO_MEDIDOR || payload?.evidenciaFotografica?.entornoMedidor || '',
    };

    const reporteData = {
      ...payload,
      evidenciaFotografica,
      tecnicoId: payload.tecnicoId || req.tecnico?.tecnicoId,
      nombreCliente: payload.nombreCliente || 'Cliente sin nombre',
    };

    const nuevoReporte = new Reporte(reporteData);
    const reporteGuardado = await nuevoReporte.save();

    res.status(201).json({
      message: 'Reporte enviado correctamente',
      data: reporteGuardado,
      archivos: uploadedFiles,
    });
  } catch (error) {
    res.status(400).json({ message: 'Error al enviar reporte', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const reporte = await Reporte.findById(req.params.id);

    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    res.json(reporte);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reporte', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const nuevoReporte = new Reporte(req.body);
    const reporteGuardado = await nuevoReporte.save();

    res.status(201).json({
      message: 'Reporte creado correctamente',
      data: reporteGuardado,
    });
  } catch (error) {
    res.status(400).json({ message: 'Error al crear reporte', error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const reporteActual = await Reporte.findById(req.params.id);

    if (!reporteActual) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    const camposPermitidos = [
      'estatus',
      'comentariosOficina',
      'modificadoPorOficina',
      'datosTecnicos',
      'evidenciaFotografica',
    ];

    const cambios = {};

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        cambios[campo] = req.body[campo];
      }
    }

    if (Object.keys(cambios).length === 0) {
      return res.status(400).json({ message: 'No se enviaron campos válidos para actualizar' });
    }

    const reporteActualizado = await Reporte.findByIdAndUpdate(
      req.params.id,
      {
        ...cambios,
        modificadoPorOficina: true,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.json({
      message: 'Reporte actualizado correctamente',
      data: reporteActualizado,
    });
  } catch (error) {
    res.status(400).json({ message: 'Error al actualizar reporte', error: error.message });
  }
});

module.exports = router;
