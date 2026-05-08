require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const INSTANCE = process.env.ULTRAMSG_INSTANCE || "instance173867";
const TOKEN = process.env.ULTRAMSG_TOKEN || "qb421oyq9xsx9okt";
const PORT = process.env.PORT || 8080;


const GROUP_MAP = {};
const DB = { rooms: {}, log: [], failed: [] };

function parseMsg(text) {
  const msg = text.trim();
  const egp = msg.match(/([\d,]+)\s*(?:مصري|جنيه)\s*(?:لـ?|ل\s)?\s*(.+)/i);
  const sdg = msg.match(/([\d,]+)\s*(?:سوداني)\s*(?:لـ?|ل\s)?\s*(.+)/i);
  const lyd = msg.match(/(?:تحويل|ارسل)?\s*([\d,]+)\s*(?:دينار|ليبي)?\s*(?:لـ?|ل\s)?\s*(.+)/i);
  if (egp) return { ok:true, amount:+egp[1].replace(/,/g,""), currency:"EGP", recipient:egp[2].trim(), type:"تحويل مصر" };
  if (sdg) return { ok:true, amount:+sdg[1].replace(/,/g,""), currency:"SDG", recipient:sdg[2].trim(), type:"تحويل السودان" };
  if (lyd) return { ok:true, amount:+lyd[1].replace(/,/g,""), currency:"LYD", recipient:lyd[2].trim(), type:"تحويل داخلي" };
  return { ok:false };
}

app.post("/webhook", (req, res) => {
  const data = req.body?.data;
  if (!data || data.fromMe) return res.sendStatus(200);
  if (data.type !== "chat") return res.sendStatus(200);
  const roomId = GROUP_MAP[data.to] || GROUP_MAP[data.from];
  if (!roomId) return res.sendStatus(200);
  const p = parseMsg(data.body || "");
  if (p.ok) {
    const entry = { id:"WA-"+Date.now(), time:new Date().toLocaleTimeString("ar"), ...p, from:data.from };
    if (!DB.rooms[roomId]) DB.rooms[roomId] = { ledger:[], total:0 };
    DB.rooms[roomId].ledger.push(entry);
    DB.log.unshift(entry);
    axios.post(`https://api.ultramsg.com/${INSTANCE}/messages/chat`,
      { token:TOKEN, to:data.to||data.from, body:`✅ تم التسجيل\n👤 ${entry.recipient}\n💰 ${entry.amount} ${entry.currency}` }
    ).catch(()=>{});
  } else {
    DB.failed.unshift({ text:data.body, from:data.from, roomId, time:new Date().toLocaleTimeString() });
  }
  res.sendStatus(200);
});

app.get("/api/rooms", (req, res) => res.json(DB.rooms));
app.get("/api/logs", (req, res) => res.json(DB.log.slice(0,50)));
app.get("/api/failed", (req, res) => res.json(DB.failed.slice(0,50)));
app.post("/api/link", (req, res) => {
  const { groupId, roomId } = req.body;
  GROUP_MAP[groupId] = roomId;
  res.json({ ok:true });
});
app.post("/api/test", (req, res) => res.json(parseMsg(req.body.text||"")));
app.get("/", (req, res) => res.send("✅ Sarafa Webhook Server Running"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
