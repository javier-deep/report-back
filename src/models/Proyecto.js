const mongoose = require('mongoose');

const proyectoSchema = new mongoose.Schema(
  {
    proyectoId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    nombreCliente: {
      type: String,
      required: true,
      trim: true,
    },
    direccion: {
      type: String,
      default: '',
      trim: true,
    },
    telefono: {
      type: String,
      default: '',
      trim: true,
    },
    tecnicoAsignado: {
      type: String,
      default: '',
      trim: true,
    },
    estado: {
      type: String,
      default: 'Activo',
      trim: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    collection: 'proyectos',
  }
);

module.exports = mongoose.model('Proyecto', proyectoSchema, 'proyectos');
