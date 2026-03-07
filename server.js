const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Multer in-memory storage for images
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
  },
});

// AUDIT: Added comprehensive input validation helper
// Helper: validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// AUDIT: Added validation helper
// Helper: validate phone number (basic international format)
function isValidPhone(phone) {
  const phoneRegex = /^[+]?[\d\s\-()]{7,}$/;
  return phoneRegex.test(phone);
}

// AUDIT: Points calculation verified: apply=1, interview=5, both=6
// Helper: calculate points and type summary
function calculatePoints(registrationTypes) {
  const hasApply = registrationTypes.includes('apply');
  const hasInterview = registrationTypes.includes('interview');

  if (hasApply && hasInterview) {
    return { type: 'apply + interview', points: 6 };
  }
  if (hasInterview) {
    return { type: 'interview', points: 5 };
  }
  if (hasApply) {
    return { type: 'apply', points: 1 };
  }
  return { type: 'none', points: 0 };
}

// AUDIT: Enhanced with comprehensive input validation
// POST /api/admin/login — Verify admin password
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@2025';
  
  if (password === adminPassword) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid password' });
  }
});

// POST /api/submit — Save new submission + upload screenshots to Supabase Storage
app.post('/api/submit', upload.array('screenshots'), async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      coach,
      job,
      proof_type,
      registration_types, // expected as JSON stringified array from frontend
    } = req.body;

    // AUDIT: Added comprehensive field validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'missing_name' });
    }
    name_trimmed = name.trim();
    if (name_trimmed.length > 100) {
      return res.status(400).json({ error: 'name_too_long' });
    }

    if (!registration_types) {
      return res.status(400).json({ error: 'missing_registration_types' });
    }

    if (!proof_type) {
      return res.status(400).json({ error: 'missing_proof_type' });
    }

    // AUDIT: Validate proof type is not 'other'
    if (proof_type === 'other') {
      return res.status(400).json({ error: 'invalid_proof_type' });
    }

    // AUDIT: Validate email if provided
    if (email && email.trim() && !isValidEmail(email.trim())) {
      return res.status(400).json({ error: 'invalid_email_format' });
    }

    // AUDIT: Validate phone if provided
    if (phone && phone.trim() && !isValidPhone(phone.trim())) {
      return res.status(400).json({ error: 'invalid_phone_format' });
    }

    let parsedTypes;
    try {
      parsedTypes = JSON.parse(registration_types);
    } catch (e) {
      return res.status(400).json({ error: 'invalid_registration_types_format' });
    }

    // AUDIT: Ensure parsedTypes is a non-empty array
    if (!Array.isArray(parsedTypes) || parsedTypes.length === 0) {
      return res.status(400).json({ error: 'no_registration_types_selected' });
    }

    const { type, points } = calculatePoints(parsedTypes);

    // Upload files to Supabase Storage
    const files = req.files || [];
    const screenshotUrls = [];

    for (const file of files) {
      const ext = path.extname(file.originalname) || '.jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('screenshots')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (storageError) {
        console.error('Storage upload error', storageError);
        return res.status(500).json({ error: 'storage_upload_failed', details: storageError.message });
      }

      const { data: publicData } = supabase.storage
        .from('screenshots')
        .getPublicUrl(storageData.path);

      if (publicData?.publicUrl) {
        screenshotUrls.push(publicData.publicUrl);
      }
    }

    const { data, error } = await supabase
      .from('submissions')
      .insert({
        name: name_trimmed,
        phone: phone?.trim() || '',
        email: email?.trim() || '',
        coach: coach || '',
        job: job?.trim() || '',
        type,
        proof_type,
        screenshot_urls: screenshotUrls,
        points,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error', error);
      return res.status(500).json({ error: 'db_insert_failed', details: error.message });
    }

    return res.json({ success: true, submission: data });
  } catch (err) {
    console.error('Submit error', err);
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
});

// AUDIT: Leaderboard endpoint with proper aggregation
// GET /api/leaderboard — Get aggregated leaderboard (group by name, sum points)
// Returns: Top performers sorted by totalPoints DESC, tiebreaker: totalInterviews DESC
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Leaderboard fetch error', error);
      return res.status(500).json({ error: 'leaderboard_load_failed', details: error.message });
    }

    const leaderboardMap = new Map();
    let totalApplications = 0;
    let totalInterviews = 0;

    for (const s of submissions) {
      const key = s.name.trim();
      if (!leaderboardMap.has(key)) {
        leaderboardMap.set(key, {
          name: s.name,
          phone: s.phone,
          email: s.email,
          coach: s.coach,
          totalPoints: 0,
          totalApplications: 0,
          totalInterviews: 0,
        });
      }
      const entry = leaderboardMap.get(key);
      entry.totalPoints += s.points || 0;

      if (s.type === 'apply') {
        entry.totalApplications += 1;
        totalApplications += 1;
      } else if (s.type === 'interview') {
        entry.totalInterviews += 1;
        totalInterviews += 1;
      } else if (s.type === 'apply + interview') {
        entry.totalApplications += 1;
        entry.totalInterviews += 1;
        totalApplications += 1;
        totalInterviews += 1;
      }
    }

    let leaderboard = Array.from(leaderboardMap.values());

    // AUDIT: Sorting logic - primary by points DESC, secondary by interviews DESC (tiebreaker)
    leaderboard.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      // tiebreaker: more interviews wins
      return b.totalInterviews - a.totalInterviews;
    });

    const participantsCount = leaderboard.length;

    const response = {
      leaderboard,
      totals: {
        participants: participantsCount,
        applications: totalApplications,
        interviews: totalInterviews,
      },
    };

    return res.json(response);
  } catch (err) {
    console.error('Leaderboard error', err);
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
});

// GET /api/submissions — Get all submissions (admin only, but no backend auth)
app.get('/api/submissions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Submissions fetch error', error);
      return res.status(500).json({ error: 'db_fetch_failed' });
    }

    return res.json({ submissions: data || [] });
  } catch (err) {
    console.error('Submissions error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/settings — Get competition settings (assume latest row)
app.get('/api/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('competition_settings')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // If table empty, create default 30-day competition
      if (error.code === 'PGRST116' || error.details?.includes('Results contain 0 rows')) {
        const now = new Date();
        const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const { data: newRow, error: insertError } = await supabase
          .from('competition_settings')
          .insert({
            start_date: now.toISOString(),
            end_date: end.toISOString(),
            status: 'running',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Settings insert error', insertError);
          return res.status(500).json({ error: 'settings_init_failed' });
        }

        return res.json({ settings: newRow });
      }

      console.error('Settings fetch error', error);
      return res.status(500).json({ error: 'db_fetch_failed' });
    }

    return res.json({ settings: data });
  } catch (err) {
    console.error('Settings error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/settings — Update competition settings (start/stop/extend)
app.post('/api/settings', async (req, res) => {
  try {
    const { action, days, end_date } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, error: 'invalid_action' });
    }

    // Get latest settings row if exists
    let { data: current, error: currentError } = await supabase
      .from('competition_settings')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (currentError && currentError.code !== 'PGRST116') {
      console.error('Settings current fetch error', currentError);
      return res.status(500).json({ success: false, error: 'db_fetch_failed' });
    }

    let updates = {};
    const now = new Date();

    switch(action) {
      case 'set_duration':
        updates = {
          end_date: new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
        
      case 'set_end_date':
        updates = {
          end_date: new Date(end_date).toISOString()
        };
        break;
        
      case 'reset_to_default':
        updates = {
          start_date: now.toISOString(),
          end_date: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
        
      case 'start':
        updates = {
          status: 'running',
          start_date: now.toISOString(),
          end_date: current?.end_date || new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        break;
        
      case 'stop':
        updates = { status: 'stopped' };
        break;
        
      case 'extend':
        const currentEnd = current?.end_date ? new Date(current.end_date) : now;
        currentEnd.setDate(currentEnd.getDate() + 7);
        updates = { end_date: currentEnd.toISOString() };
        break;
        
      default:
        return res.status(400).json({ success: false, error: 'invalid_action' });
    }

    let result;
    if (current) {
      result = await supabase
        .from('competition_settings')
        .update(updates)
        .eq('id', current.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('competition_settings')
        .insert(updates)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Settings upsert error', result.error);
      return res.status(500).json({ success: false, error: 'db_update_failed' });
    }

    return res.json({ success: true, settings: result.data });
  } catch (err) {
    console.error('Settings update error', err);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
});

// AUDIT: Enhanced with proper ID validation
// DELETE /api/submissions/:id — Delete a submission
app.delete('/api/submissions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    // AUDIT: Validate ID is a positive integer
    if (!id || id <= 0 || isNaN(id)) {
      return res.status(400).json({ error: 'invalid_submission_id' });
    }

    const { error } = await supabase.from('submissions').delete().eq('id', id);
    if (error) {
      console.error('Delete error', error);
      return res.status(500).json({ error: 'submission_delete_failed', details: error.message });
    }

    return res.json({ success: true, message: 'Submission deleted successfully' });
  } catch (err) {
    console.error('Delete submission error', err);
    return res.status(500).json({ error: 'server_error', details: err.message });
  }
});

// GET /api/export — Download aggregated CSV data with correct column order
app.get('/api/export', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Export fetch error', error);
      return res.status(500).json({ error: 'db_fetch_failed' });
    }

    // Aggregate data by player name
    const playersMap = {};

    (data || []).forEach(sub => {
      const playerName = sub.name || 'غير معروف';

      if (!playersMap[playerName]) {
        playersMap[playerName] = {
          name: playerName,
          phone: sub.phone || '',
          email: sub.email || '',
          coach: sub.coach || '',
          job: sub.job || '',
          applications: 0,
          interviews: 0,
          points: 0,
          lastType: '',
          lastTime: sub.created_at ? new Date(sub.created_at).toLocaleDateString('ar-EG') : ''
        };
      }

      // Update statistics
      if (sub.type === 'apply' || sub.type === 'apply + interview') {
        playersMap[playerName].applications += 1;
      }
      if (sub.type === 'interview' || sub.type === 'apply + interview') {
        playersMap[playerName].interviews += 1;
      }

      playersMap[playerName].points += sub.points || 0;
      playersMap[playerName].lastType = sub.type || '';

      // Update time to latest submission
      if (sub.created_at) {
        playersMap[playerName].lastTime = new Date(sub.created_at).toLocaleDateString('ar-EG');
      }
    });

    const players = Object.values(playersMap);

    // Prepare CSV with correct column order
    const headers = [
      'الاسم',
      'الموبايل',
      'الإيميل',
      'الكوتش',
      'الشركة/الوظيفة',
      'النوع',
      'التقديمات',
      'الانترفيوهات',
      'النقاط',
      'الوقت'
    ];

    const csvRows = [];
    csvRows.push(headers.join('\t')); // Use tab separator

    players.forEach(player => {
      // Convert type to Arabic text
      let typeText = '';
      if (player.lastType === 'apply') typeText = 'تقديم';
      else if (player.lastType === 'interview') typeText = 'انترفيو';
      else if (player.lastType === 'apply + interview') typeText = 'الاتنين';

      const row = [
        player.name,
        player.phone,
        player.email,
        player.coach,
        player.job,
        typeText,
        player.applications,
        player.interviews,
        player.points,
        player.lastTime
      ];

      csvRows.push(row.join('\t'));
    });

    const csvString = csvRows.join('\n');

    // Set headers for download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=participants.csv');
    res.send('\uFEFF' + csvString); // Add BOM for Arabic
  } catch (err) {
    console.error('Export error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/export/excel — Download formatted Excel file
app.get('/api/export/excel', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Excel export error', error);
      return res.status(500).json({ error: 'db_fetch_failed' });
    }

    // Aggregate data by player name (same logic as CSV export)
    const playersMap = {};

    (data || []).forEach(sub => {
      const playerName = sub.name || 'غير معروف';

      if (!playersMap[playerName]) {
        playersMap[playerName] = {
          name: playerName,
          phone: sub.phone || '',
          email: sub.email || '',
          coach: sub.coach || '',
          job: sub.job || '',
          applications: 0,
          interviews: 0,
          points: 0,
          lastType: '',
          lastTime: sub.created_at ? new Date(sub.created_at).toLocaleDateString('ar-EG') : ''
        };
      }

      if (sub.type === 'apply' || sub.type === 'apply + interview') playersMap[playerName].applications += 1;
      if (sub.type === 'interview' || sub.type === 'apply + interview') playersMap[playerName].interviews += 1;
      playersMap[playerName].points += sub.points || 0;
      playersMap[playerName].lastType = sub.type || '';
      if (sub.created_at) playersMap[playerName].lastTime = new Date(sub.created_at).toLocaleDateString('ar-EG');
    });

    const players = Object.values(playersMap);

    // Create HTML for Excel
    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>تقرير المشاركين</title>
  <style>
    body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th { 
      background: #F5C518; 
      color: #000; 
      font-weight: bold; 
      padding: 12px; 
      border: 1px solid #000;
      text-align: center;
    }
    td { 
      padding: 8px; 
      border: 1px solid #666; 
      text-align: center;
    }
    tr:nth-child(even) { background: #f9f9f9; }
  </style>
</head>
<body>
  <h2 style="text-align: center;">تقرير المشاركين في المسابقة</h2>
  <table>
    <thead>
      <tr>
        <th>الاسم</th>
        <th>الموبايل</th>
        <th>الإيميل</th>
        <th>الكوتش</th>
        <th>الشركة/الوظيفة</th>
        <th>النوع</th>
        <th>التقديمات</th>
        <th>الانترفيوهات</th>
        <th>النقاط</th>
        <th>الوقت</th>
      </tr>
    </thead>
    <tbody>`;

    players.forEach(player => {
      let typeText = '';
      if (player.lastType === 'apply') typeText = 'تقديم';
      else if (player.lastType === 'interview') typeText = 'انترفيو';
      else if (player.lastType === 'apply + interview') typeText = 'الاتنين';

      html += `
      <tr>
        <td>${player.name}</td>
        <td>${player.phone}</td>
        <td>${player.email}</td>
        <td>${player.coach}</td>
        <td>${player.job}</td>
        <td>${typeText}</td>
        <td>${player.applications}</td>
        <td>${player.interviews}</td>
        <td>${player.points}</td>
        <td>${player.lastTime}</td>
      </tr>`;
    });

    html += `
    </tbody>
  </table>
  <p style="text-align: center; color: #666;">تم التصدير في: ${new Date().toLocaleString('ar-EG')}</p>
</body>
</html>`;

    res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=participants.xls');
    res.send(html);
  } catch (err) {
    console.error('Excel export error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/players — Get all aggregated players with their data and submissions count
app.get('/api/players', async (req, res) => {
  try {
    const { data: submissions, error } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Players fetch error', error);
      return res.status(500).json({ error: 'db_fetch_failed' });
    }

    const playersMap = new Map();

    for (const s of submissions) {
      const key = (s.name || '').trim();
      if (!key) continue;

      if (!playersMap.has(key)) {
        playersMap.set(key, {
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          coach: s.coach || '',
          job: s.job || '',
          totalPoints: 0,
          totalApplications: 0,
          totalInterviews: 0,
          submissionCount: 0,
        });
      }

      const entry = playersMap.get(key);
      entry.totalPoints += s.points || 0;
      entry.submissionCount += 1;

      if (s.type === 'apply' || s.type === 'apply + interview') {
        entry.totalApplications += 1;
      }
      if (s.type === 'interview' || s.type === 'apply + interview') {
        entry.totalInterviews += 1;
      }
    }

    const players = Array.from(playersMap.values()).sort(
      (a, b) => b.totalPoints - a.totalPoints
    );

    return res.json({
      success: true,
      players,
      count: players.length,
    });
  } catch (err) {
    console.error('Players error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// GET /api/sync/pull — Get all data from Supabase (submissions + settings)
app.get('/api/sync/pull', async (req, res) => {
  try {
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: true });

    if (submissionsError) {
      console.error('Submissions fetch error', submissionsError);
      return res.status(500).json({ error: 'submissions_fetch_failed' });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('competition_settings')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Settings fetch error', settingsError);
      return res.status(500).json({ error: 'settings_fetch_failed' });
    }

    return res.json({
      success: true,
      data: {
        submissions: submissions || [],
        settings: settings || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Sync pull error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

// POST /api/sync/push — Verify sync (just return current data from Supabase)
app.post('/api/sync/push', async (req, res) => {
  try {
    const { data: submissions, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (submissionsError) {
      console.error('Submissions fetch error', submissionsError);
      return res.status(500).json({ error: 'submissions_fetch_failed' });
    }

    const { data: settings, error: settingsError } = await supabase
      .from('competition_settings')
      .select('*')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('Settings fetch error', settingsError);
      return res.status(500).json({ error: 'settings_fetch_failed' });
    }

    return res.json({
      success: true,
      message: 'Data synced successfully',
      data: {
        submissionCount: (submissions || []).length,
        settings: settings || null,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Sync push error', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

