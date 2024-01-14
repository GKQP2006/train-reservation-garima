const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
    seatNumber: { type: Number, required: true },
    rowNumber: { type: Number, required: true },
    status: { type: String, enum: ['empty', 'reserved', 'booked'], default: 'empty' },
  });

const Seat = mongoose.model('Seat', seatSchema);

module.exports = Seat;
