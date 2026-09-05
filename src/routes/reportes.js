const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const PDFDocument = require('pdfkit');
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

const requiredEvidenceKeys = [
  'estructuraFijacion',
  'panelesEtiqueta',
  'inversoresEtiqueta',
  'proteccionesCDCA',
  'medicionesVoltaje',
];

const normalizeImageUrl = (url) => {
  if (!url) return null;

  let normalized = String(url).trim();
  normalized = normalized.replace(/(\.jpe?g)\.jpe?g$/i, '$1').replace(/(\.png)\.png$/i, '$1');

  if (/^https?:\/\//i.test(normalized)) return normalized;

  if (normalized.startsWith('/')) {
    return `${process.env.BASE_URL || 'http://localhost:4000'}${normalized}`;
  }

  return `${process.env.BASE_URL || 'http://localhost:4000'}/${normalized.replace(/^\/+/, '')}`;
};

const getReportValidationIssues = (reporte) => {
  const issues = [];

  if (!reporte?.proyectoId) issues.push('Falta proyectoId');
  if (!reporte?.nombreCliente) issues.push('Falta nombreCliente');
  if (!reporte?.tecnicoId) issues.push('Falta tecnicoId');
  if (!reporte?.datosTecnicos || Object.keys(reporte.datosTecnicos).length === 0) {
    issues.push('Faltan datos técnicos');
  }

  const evidencia = reporte?.evidenciaFotografica || {};
  for (const key of requiredEvidenceKeys) {
    if (!evidencia[key]) {
      issues.push(`Falta imagen de ${key}`);
    }
  }

  return issues;
};

const buildPdf = async (reporte) => {
  const doc = new PDFDocument({ size: 'A4', margin: 42 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));

  const promise = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const addImageIfPossible = async (key, value) => {
    if (!value) return;

    const url = normalizeImageUrl(value);
    if (!url) return;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo cargar la imagen');
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('image/')) throw new Error('La URL no es una imagen');
      const buffer = Buffer.from(await response.arrayBuffer());
      doc.moveDown(0.8);
      doc.fontSize(11).font('Helvetica-Bold').text(`${key}:`);
      doc.image(buffer, { fit: [220, 180], align: 'center' });
    } catch (_error) {
      doc.moveDown(0.8);
      doc.fontSize(11).font('Helvetica-Bold').text(`${key}:`);
      doc.font('Helvetica').text('No se pudo cargar la imagen en el PDF.');
    }
  };

  doc.fillColor('#0f172a');
  doc.roundedRect(40, 40, 515, 92, 10).fill('#edf2f7');
  doc.fillColor('#0f172a');
  doc.rect(56, 55, 54, 54).fill('#e2e8f0');
  doc.fillColor('#12314a');
  doc.fontSize(18).font('Helvetica-Bold').text('SF', 72, 72, { width: 26, align: 'center' });
  doc.fillColor('#0f172a');
  doc.fontSize(18).font('Helvetica-Bold').text('Sistema Fotovoltaico', 125, 62);
  doc.fontSize(9).font('Helvetica').text('Reporte técnico de instalación y supervisión', 126, 86);
  doc.fontSize(9).font('Helvetica-Bold').text('Proyecto:', 380, 62);
  doc.fontSize(9).font('Helvetica').text(reporte.proyectoId || '-', 440, 62);
  doc.fontSize(9).font('Helvetica-Bold').text('Fecha:', 380, 78);
  doc.fontSize(9).font('Helvetica').text(new Date(reporte.fechaCreacion || Date.now()).toLocaleDateString('es-MX'), 440, 78);
  doc.moveDown(2.4);

  doc.fontSize(12).font('Helvetica-Bold').text(`Cliente: ${reporte.nombreCliente || '-'}`);
  doc.fontSize(11).font('Helvetica').text(`Técnico: ${reporte.tecnicoId || '-'}`);
  doc.text(`Domicilio: ${reporte.direccion || '-'}`);
  doc.text(`Estado: ${reporte.estatus || 'Pendiente'}`);
  doc.moveDown();

  if (reporte.comentariosOficina) {
    doc.font('Helvetica-Bold').text('Comentario de oficina:');
    doc.font('Helvetica').text(reporte.comentariosOficina);
    doc.moveDown();
  }

  doc.font('Helvetica-Bold').text('Datos técnicos:');
  const datos = reporte.datosTecnicos || {};
  Object.entries(datos).forEach(([key, value]) => {
    if (typeof value === 'object' && value !== null) {
      Object.entries(value).forEach(([nestedKey, nestedValue]) => {
        doc.font('Helvetica').text(`${key}.${nestedKey}: ${nestedValue}`);
      });
      return;
    }
    doc.font('Helvetica').text(`${key}: ${value}`);
  });

  doc.addPage();
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('EVIDENCIA FOTOGRÁFICA', { align: 'center' });
  doc.moveDown();

  const fotos = Object.entries(reporte.evidenciaFotografica || {});

  if (fotos.length === 0) {
    doc.font('Helvetica').text('No se adjuntaron imágenes.');
  } else {
    for (const [key, value] of fotos) {
      await addImageIfPossible(key, value);
    }
  }

  doc.end();

  return promise;
};

router.get('/', async (req, res) => {
  try {
    const reportes = await Reporte.find().sort({ fechaCreacion: -1 });
    res.json(reportes);
  } catch (error) {
    res.status(500).json({ message: 'Error al listar reportes', error: error.message });
  }
});

router.get('/pendientes', async (req, res) => {
  try {
    const reportes = await Reporte.find({ estatus: 'Pendiente' }).sort({ fechaCreacion: -1 });

    return res.json({
      ok: true,
      count: reportes.length,
      data: reportes.map((reporte) => ({
        _id: reporte._id,
        proyectoId: reporte.proyectoId,
        nombreCliente: reporte.nombreCliente,
        tecnicoId: reporte.tecnicoId,
        fechaCreacion: reporte.fechaCreacion,
        estatus: reporte.estatus,
        datosTecnicos: reporte.datosTecnicos,
        evidenciaFotografica: reporte.evidenciaFotografica,
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error al listar reportes pendientes', error: error.message });
  }
});

router.post('/enviar', upload.fields(allowedKeys.map((key) => ({ name: key, maxCount: 1 }))), async (req, res) => {
  try {
    const rawPayload = req.body.json || req.body.datos || req.body.payload || null;

    if (!rawPayload) {
      return res.status(400).json({ message: 'El campo json/datos es obligatorio' });
    }

    let payload;
    try {
      payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    } catch (_error) {
      return res.status(400).json({ message: 'El campo json/datos debe ser un JSON válido' });
    }

    const uploadedFiles = {};
    const rawFiles = req.files || {};

    for (const key of allowedKeys) {
      const file = rawFiles[key]?.[0] || rawFiles[key];
      if (file) {
        uploadedFiles[key] = `${req.protocol}://${req.get('host')}/uploads/${file.filename}`;
      }
    }

    const evidenciaFotografica = {
      estructuraFijacion: uploadedFiles.ESTRUCTURA_FIJACION || payload?.evidenciaFotografica?.estructuraFijacion || payload?.evidenciaFotografica?.ESTRUCTURA_FIJACION || '',
      panelesEtiqueta: uploadedFiles.PANELES_ETIQUETA || payload?.evidenciaFotografica?.panelesEtiqueta || payload?.evidenciaFotografica?.PANELES_ETIQUETA || '',
      inversoresEtiqueta: uploadedFiles.INVERSORES_ETIQUETA || payload?.evidenciaFotografica?.inversoresEtiqueta || payload?.evidenciaFotografica?.INVERSORES_ETIQUETA || '',
      ducteria: uploadedFiles.DUCTERIA || payload?.evidenciaFotografica?.ducteria || payload?.evidenciaFotografica?.DUCTERIA || '',
      proteccionesCDCA: uploadedFiles.PROTECCIONES_CD_CA || payload?.evidenciaFotografica?.proteccionesCDCA || payload?.evidenciaFotografica?.PROTECCIONES_CD_CA || '',
      medicionesVoltaje: uploadedFiles.MEDICIONES_VOLTAJE || payload?.evidenciaFotografica?.medicionesVoltaje || payload?.evidenciaFotografica?.MEDICIONES_VOLTAJE || '',
      puestaATerra: uploadedFiles.PUESTA_TIERRA || payload?.evidenciaFotografica?.puestaATerra || payload?.evidenciaFotografica?.PUESTA_TIERRA || '',
      entornoMedidor: uploadedFiles.ENTORNO_MEDIDOR || payload?.evidenciaFotografica?.entornoMedidor || payload?.evidenciaFotografica?.ENTORNO_MEDIDOR || '',
    };

    const datosTecnicos = {
      ...(payload?.datosTecnicos || {}),
      modulosCantidad: payload?.datosTecnicos?.modulosCantidad ?? payload?.modulosCantidad ?? 0,
      modulosPotenciaWatts: payload?.datosTecnicos?.modulosPotenciaWatts ?? payload?.modulosPotenciaWatts ?? 0,
      inversoresCantidad: payload?.datosTecnicos?.inversoresCantidad ?? payload?.inversoresCantidad ?? 0,
      inversoresPotenciaWatts: payload?.datosTecnicos?.inversoresPotenciaWatts ?? payload?.inversoresPotenciaWatts ?? 0,
      numStringsPorInversor: payload?.datosTecnicos?.numStringsPorInversor ?? payload?.numStringsPorInversor ?? 0,
      panelesPorString: payload?.datosTecnicos?.panelesPorString ?? payload?.panelesPorString ?? '',
      voltajeAC: payload?.datosTecnicos?.voltajeAC ?? payload?.voltajeAC ?? 0,
      numFases: payload?.datosTecnicos?.numFases ?? payload?.numFases ?? 0,
      calibreCableCD: payload?.datosTecnicos?.calibreCableCD ?? payload?.calibreCableCD ?? '2 AWG',
      calibreCableCA: payload?.datosTecnicos?.calibreCableCA ?? payload?.calibreCableCA ?? 'Cal 3/0 Cobre',
      calibreAcometida: payload?.datosTecnicos?.calibreAcometida ?? payload?.calibreAcometida ?? '',
      calibreMedidorTablero: payload?.datosTecnicos?.calibreMedidorTablero ?? payload?.calibreMedidorTablero ?? '',
      medicionesVOC: payload?.datosTecnicos?.medicionesVOC || payload?.medicionesVOC || {
        voc1: 0,
        voc2: 0,
        voc3: 0,
        voc4: 0,
      },
    };

    const reporteData = {
      ...payload,
      datosTecnicos,
      evidenciaFotografica,
      tecnicoId: payload.tecnicoId || req.tecnico?.tecnicoId || 'Sin técnico',
      nombreCliente: payload.nombreCliente || 'Cliente sin nombre',
      proyectoId: payload.proyectoId || 'SIN-PROYECTO',
      fechaCreacion: payload.fechaCreacion || payload.fechaEnvio || new Date(),
    };

    const issues = getReportValidationIssues(reporteData);
    if (issues.length > 0) {
      return res.status(400).json({
        message: 'El reporte no cumple la validación requerida',
        issues,
      });
    }

    const nuevoReporte = new Reporte(reporteData);
    const reporteGuardado = await nuevoReporte.save();

    res.status(201).json({
      message: 'Reporte enviado correctamente',
      data: reporteGuardado,
      archivos: uploadedFiles,
      issues: [],
    });
  } catch (error) {
    res.status(400).json({ message: 'Error al enviar reporte', error: error.message });
  }
});

router.get('/:id', async (req, res, next) => {
  if (['pendientes', 'pdf', 'revisar'].includes(req.params.id)) {
    return next();
  }

  try {
    const reporte = await Reporte.findById(req.params.id);

    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    const issues = getReportValidationIssues(reporte.toObject());
    res.json({
      ok: true,
      data: reporte.toObject(),
      issues,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reporte', error: error.message });
  }
});

router.patch('/:id/revisar', async (req, res) => {
  try {
    const { estatus, comentariosOficina } = req.body || {};

    const reporte = await Reporte.findById(req.params.id);
    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    if (!['Aprobado', 'Rechazado'].includes(estatus)) {
      return res.status(400).json({ message: 'El estatus debe ser Aprobado o Rechazado' });
    }

    const issues = getReportValidationIssues(reporte.toObject());
    if (estatus === 'Aprobado' && issues.length > 0) {
      return res.status(400).json({
        message: 'No se puede aprobar un reporte con datos incompletos',
        issues,
      });
    }

    reporte.estatus = estatus;
    reporte.comentariosOficina = comentariosOficina || '';
    reporte.modificadoPorOficina = true;

    const actualizado = await reporte.save();

    return res.json({
      ok: true,
      message: `Reporte ${estatus.toLowerCase()} correctamente`,
      data: actualizado,
    });
  } catch (error) {
    return res.status(400).json({ message: 'Error al revisar reporte', error: error.message });
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const reporte = await Reporte.findById(req.params.id);

    if (!reporte) {
      return res.status(404).json({ message: 'Reporte no encontrado' });
    }

    const issues = getReportValidationIssues(reporte.toObject());
    if (issues.length > 0) {
      return res.status(400).json({
        message: 'El reporte tiene datos incompletos y no puede exportarse a PDF',
        issues,
      });
    }

    const pdfBuffer = await buildPdf(reporte.toObject());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-${reporte.proyectoId}.pdf"`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: 'Error al generar PDF', error: error.message });
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
