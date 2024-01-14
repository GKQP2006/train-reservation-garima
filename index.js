// Connect to MongoDB (make sure your MongoDB server is running)
const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://hr43c6861:nxtiN0momKW0q18H@cluster0.z8lkjd3.mongodb.net/?retryWrites=true&w=majority');

const express = require('express');
// const Seat = require('./models/seat');

const app = express();
const PORT = 3004;

app.use(express.json());

const seatSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true },
  rowNumber: { type: Number, required: true },
  status: { type: String, enum: ['empty', 'reserved', 'booked'], default: 'empty' },
});

const Seat = mongoose.model('Seat', seatSchema);

async function initializeSeats() {
    const existingSeats = await Seat.find();
    if (existingSeats.length === 0) {
      for (let row = 1; row <= 12; row++) {
        const totalSeatsInRow = row === 12 ? 3 : 7;
        for (let seatNumber = 1; seatNumber <= totalSeatsInRow; seatNumber++) {
          await Seat.create({ seatNumber, rowNumber: row, status: 'empty' });
        }
      }
    }
  }
  
  

app.get('/seats', async (req, res) => {
  try {
    const seatMatrix = await getSeatMatrix();
    res.json({ seatMatrix });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

async function getSeatMatrix() {
  const seats = await Seat.find();
  const maxRow = 12; 
  const seatMatrix = Array(maxRow)
    .fill()
    .map((_, rowIndex) => {
      const totalSeatsInRow = rowIndex === maxRow - 1 ? 3 : 7;
      return Array(totalSeatsInRow).fill({ booked: false });
    });

  seats.forEach(seat => {
    if (seat.status === 'booked') {
      seatMatrix[seat.rowNumber - 1][seat.seatNumber - 1].booked = true;
    }
  });

  return seatMatrix;
}

app.post('/reserve', async (req, res) => {
  const { numSeatsToReserve } = req.body;

  if (numSeatsToReserve > 7) {
    res.status(400).json({ message: 'We cannot book more than 7 seats at once' });
    return;
  }

  try {
    const reservedSeats = await reserveSeats(numSeatsToReserve);
    const seats = await Seat.find();
    res.json({ message: 'Seats reserved successfully', reservedSeats, seats });
  } catch (error) {
    console.error(error);
    res.json({ message: 'Seats Full'});
    return;
  }
});

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
        return 'Not enough available seats.';
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

async function startServer() {
  await initializeSeats();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
