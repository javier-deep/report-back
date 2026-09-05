const mongoose = require('mongoose');

const evidenciaFotograficaSchema = new mongoose.Schema(
  {
    estructuraFijacion: { type: String, required: true },
    panelesEtiqueta: { type: String, required: true },
    inversoresEtiqueta: { type: String, required: true },
    ducteria: { type: String, default: '' },
    proteccionesCDCA: { type: String, required: true },
    medicionesVoltaje: { type: String, required: true },
    puestaATerra: { type: String, default: '' },
    entornoMedidor: { type: String, default: '' },
  },
  { _id: false }
);

const medicionesVOCSchema = new mongoose.Schema(
  {
    voc1: { type: Number, required: true, default: 0 },
    voc2: { type: Number, required: true, default: 0 },
    voc3: { type: Number, required: true, default: 0 },
    voc4: { type: Number, required: true, default: 0 },
  },
  { _id: false }
);

const datosTecnicosSchema = new mongoose.Schema(
  {
    modulosCantidad: { type: Number, required: true },
    modulosPotenciaWatts: { type: Number, required: true },
    inversoresCantidad: { type: Number, required: true },
    inversoresPotenciaWatts: { type: Number, required: true },
    numStringsPorInversor: { type: Number, default: 0 },
    panelesPorString: { type: String, default: '' },
    medicionesVOC: { type: medicionesVOCSchema, required: true },
    voltajeAC: { type: Number, default: 0 },
    numFases: { type: Number, default: 0 },
    calibreCableCD: {
      type: String,
      enum: ['8 AWG', '6 AWG', '4 AWG', '2 AWG', 'Cal 3/0 Cobre'],
      default: '2 AWG',
    },
    calibreCableCA: {
      type: String,
      enum: ['8 AWG', '6 AWG', '4 AWG', '2 AWG', 'Cal 3/0 Cobre'],
      default: 'Cal 3/0 Cobre',
    },
    calibreAcometida: { type: String, default: '' },
    calibreMedidorTablero: { type: String, default: '' },
  },
  { _id: false }
);

const reporteSchema = new mongoose.Schema(
  {
    proyectoId: { type: String, required: true, trim: true },
    nombreCliente: { type: String, required: true, trim: true },
    tecnicoId: { type: String, required: true, trim: true },
    fechaCreacion: { type: Date, default: Date.now },
    estatus: {
      type: String,
      enum: ['Pendiente', 'Revisado', 'Aprobado', 'Rechazado'],
      default: 'Pendiente',
    },
    evidenciaFotografica: { type: evidenciaFotograficaSchema, required: true },
    datosTecnicos: { type: datosTecnicosSchema, required: true },
    comentariosOficina: { type: String, default: '' },
    modificadoPorOficina: { type: Boolean, default: false },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

module.exports = mongoose.model('Reporte', reporteSchema, 'reportes');
