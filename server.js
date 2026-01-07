require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const User = require('./models/User');

const app = express();
app.use(bodyParser.json());

// MongoDB қосу
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.log('🔴 MongoDB connection error:', err));

// Telegram Web App деректерін қабылдау
app.post('/telegram-login', async (req, res) => {
  const { id, username } = req.body; // Telegram webhook-тен келетін деректер

  if (!id) return res.status(400).send('Telegram ID missing');

  let user = await User.findOne({ telegramId: id });

  if (!user) {
    // Жаңа қолданушы тіркелді, баланс 0
    user = new User({ telegramId: id, username, balance: 0 });
    await user.save();
  }

  res.json({ success: true, user });
});

// Админ панелі: баланс қосу
app.post('/admin/add-balance', async (req, res) => {
  const { telegramId, amount } = req.body;

  if (!telegramId || typeof amount !== 'number') 
    return res.status(400).send('Missing params');

  const user = await User.findOne({ telegramId });
  if (!user) return res.status(404).send('User not found');

  user.balance += amount;
  await user.save();

  res.json({ success: true, user });
});

// Қарапайым тест
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
