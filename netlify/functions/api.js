const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');

const app = express();
app.use(cors());
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

// هنا تحط كل الـ endpoints بتاعتك من server.js
// مثال:
app.get('/api/settings', async (req, res) => {
    const { data } = await supabase.from('competition_settings').select('*').eq('id', 1).single();
    res.json(data);
});

// ... كل الـ endpoints التانية ...

// Export للـ serverless function
exports.handler = serverless(app);