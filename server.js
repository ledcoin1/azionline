require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();
app.use(express.json());

// static frontend
app.use(express.static("public"));

// ===== MONGO =====
mongoose.connect(process.env.MONGO_URI)
.then(()=>console.log("✅ MongoDB connected!"))
.catch(e=>console.log("❌ Mongo error",e));

// ===== MODEL =====
const UserSchema = new mongoose.Schema({
  telegramId: {type:String, unique:true},
  balance:{type:Number, default:0}
});

const User = mongoose.model("User",UserSchema);

// ===== LOGIN =====
app.post("/api/login", async(req,res)=>{
  try{
    const {telegramId} = req.body;

    if(!telegramId){
      return res.json({error:"No telegram id"});
    }

    let user = await User.findOne({telegramId});

    // жаңа қолданушы
    if(!user){
      user = await User.create({
        telegramId,
        balance:0
      });
    }

    res.json({
      telegramId:user.telegramId,
      balance:user.balance
    });

  }catch(err){
    res.status(500).json({error:"server error"});
  }
});

// ===== SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>{
  console.log("🚀 Server running on",PORT);
});
