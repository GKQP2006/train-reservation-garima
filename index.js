// Connect to MongoDB (make sure your MongoDB server is running)
// mongoose.connect('mongodb+srv://hr43c6861:nxtiN0momKW0q18H@cluster0.z8lkjd3.mongodb.net/?retryWrites=true&w=majority');
require("dotenv").config();

const express = require('express');
const mongoose = require('mongoose');
// const Seat = require('./models/seat');

const app = express();
const PORT = 3005;

app.use(express.json());


// Define the Seat model
const seatSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true },
  rowNumber: { type: Number, required: true },
  status: { type: String, enum: ['empty', 'reserved', 'booked'], default: 'empty' },
});

mongoose.connect(process.env.MONGO_URI);


const Seat = mongoose.model('Seat', seatSchema);

// Initialize the seats in the coach
async function initializeSeats() {
  const existingSeats = await Seat.find();
  if (existingSeats.length === 0) {
    for (let row = 1; row <= 11; row++) {
      const totalSeatsInRow = row === 11 ? 3 : 7;
      for (let seatNumber = 1; seatNumber <= totalSeatsInRow; seatNumber++) {
        await Seat.create({ seatNumber, rowNumber: row, status: 'empty' });
      }
    }
  }
}

app.get('/seats', async (req, res) => {
  try {
    const seats = await Seat.find();
    res.json(seats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/reserve', async (req, res) => {
  const { numSeatsToReserve } = req.body;

  try {
    const reservedSeats = await reserveSeats(numSeatsToReserve);
    const seats = await Seat.find();
    res.json({ message: 'Seats reserved successfully', reservedSeats, seats });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function reserveSeats(numSeatsToReserve) {
  const reservedSeats = [];

  try {
    const seatsInOneRow = await findAvailableSeatsInOneRow(numSeatsToReserve);

    if (seatsInOneRow.length === numSeatsToReserve) {
      reserveSeatsInRow(seatsInOneRow, reservedSeats);
    } else {
      const nearbySeats = await findAvailableNearbySeats(numSeatsToReserve);

      if (nearbySeats.length === numSeatsToReserve) {
        reserveSeatsInRow(nearbySeats, reservedSeats);
      } else {
        throw new Error('Not enough available seats.');
      }
    }
  } catch (error) {
    throw error;
  }

  return reservedSeats;
}

async function findAvailableSeatsInOneRow(numSeatsToReserve) {
  const availableSeats = await Seat.find({ status: 'empty' });

  for (const seat of availableSeats) {
    const seatsInOneRow = availableSeats.filter(s => s.rowNumber === seat.rowNumber && s.status === 'empty');
    if (seatsInOneRow.length >= numSeatsToReserve) {
      return seatsInOneRow.slice(0, numSeatsToReserve);
    }
  }

  return [];
}

async function findAvailableNearbySeats(numSeatsToReserve) {
  const availableSeats = await Seat.find({ status: 'empty' });

  let startIdx = -1;
  let consecutiveEmptySeats = 0;

  for (const seat of availableSeats) {
    if (consecutiveEmptySeats === 0) {
      startIdx = seat.seatNumber - 1;
    }

    consecutiveEmptySeats++;

    if (consecutiveEmptySeats === numSeatsToReserve) {
      break;
    }
  }

  if (consecutiveEmptySeats >= numSeatsToReserve) {
    return availableSeats.slice(startIdx, startIdx + numSeatsToReserve);
  }

  return [];
}

function reserveSeatsInRow(seats, reservedSeats) {
  for (const seat of seats) {
    seat.status = 'reserved';
    seat.save();
    reservedSeats.push(seat);
  }
}

app.post('/reset', async (req, res) => {
    try {
      await resetSeats();
      const seats = await Seat.find();
      res.json({ message: 'Seats reset successfully', seats });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });

  async function resetSeats() {
    try {
      await Seat.updateMany({}, { status: 'empty' });
    } catch (error) {
      throw error;
    }
  }

async function startServer() {
  await initializeSeats();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
