import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Metadata } from './Pinata.ts';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import cookieParser from 'cookie-parser';
import { 
  uploadIPORFile, 
  createOwningGroup, 
  uploadOwnershipRecord,
  addOwnershipFileToGroup
} from './Pinata.ts';
import { getFilesInGroup } from './Pinata.ts';

//declare
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cookieParser());
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// POST /api/ipor-file: Create a file with metadata only on Pinata
// This is the logic for ipor creation!!!
// POST /api/ipor-file: Create a file with metadata only on Pinata
app.post('/api/ipor-file', async (req, res) => {
  console.log('Received body:', req.body);
  try {
    const { metadata } = req.body;
    if (!metadata) {
      return res.status(400).json({ error: 'Missing metadata' });
    }
    // 1. Upload metadata file to Pinata
    const result = await uploadIPORFile(metadata as Metadata);

    // 2. Create group using ipor_name
    const group = await createOwningGroup(metadata.ipor_name);
    const group_id = group.group_id;

    // 3. Add the uploaded file to the group
    await addOwnershipFileToGroup(group_id, result.metadataFileId);

    // 4. Save result and metadata to Craft table in supabase
    const { error: dbError } = await supabase
      .from('Craft')
      .insert([
        {
          metadata_cid: result.metadataCID,
          metadata_file_id: result.metadataFileId,
          group_id,
          ...metadata
        }
      ]);

    if (dbError) {
      console.error('❌ Supabase insert error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ ...result, group_id });
  } catch (err: any) {
    console.error('❌ Error in /api/ipor-file:', err);
    res.status(500).json({ error: err.message });
  }
});


//ipor registry
//this is logic for handling ownership registration
app.post('/api/register-ownership', async (req, res) => {
  try {
    const { owner_public_key, metadata_cid } = req.body;
    if (!owner_public_key || !metadata_cid) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const signature_key = uuidv4();
    const status = true;
    const timestamp = new Date().toISOString();

    // 1. Find group_id, metadata_file_id, and metadata_cid for this IPOR
    const { data: craftRows, error: craftError } = await supabase
      .from('Craft')
      .select('group_id, metadata_file_id, metadata_cid')
      .eq('metadata_cid', metadata_cid)
      .limit(1);

    if (craftError || !craftRows || craftRows.length === 0) {
      return res.status(400).json({ error: 'Craft not found.' });
    }
    const group_id = craftRows[0].group_id;
    const ipor_metadata_file_id = craftRows[0].metadata_file_id;
    const ipor_metadata_cid = craftRows[0].metadata_cid;

    // 2. Create ownership record and upload to Pinata, then add to group
    const ownershipRecord = {
      metadata_cid: ipor_metadata_cid,
      metadata_file_id: ipor_metadata_file_id,
      owner_public_key,
      signature_key,
      timestamp
    };
    //call uploadOwnershipRecord logic from pinata.ts 
    const { ownership_cid, ownership_file_id } = await uploadOwnershipRecord(ownershipRecord);

    //add ownership file to group
    const addResult = await addOwnershipFileToGroup(group_id, ownership_file_id);

    // 3. Save ownership info to Ownership table
    const { error } = await supabase.from('Ownership').insert([{
      owner_public_key,
      signature_key,
      metadata_cid: ipor_metadata_cid,
      metadata_file_id: ipor_metadata_file_id,
      status,
      timestamp,
      ownership_cid,
      ownership_file_id
    }]);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true, ownership_cid, ownership_file_id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

//============================================================================================

//this is logic to validate ownership based on supplies
app.post('/api/validate-ownership', async (req, res) => {
  try {
    const { metadata_cid, public_key } = req.body;
    if (!metadata_cid || !public_key) {
      return res.status(400).json({ allowed: false, reason: 'Missing metadata_cid or public_key.' });
    }

    // 1. Get max supply from Craft table
    const { data: craftRows, error: craftError } = await supabase
      .from('Craft')
      .select('supplies')
      .eq('metadata_cid', metadata_cid)
      .limit(1);

    if (craftError || !craftRows || craftRows.length === 0) {
      return res.status(400).json({ allowed: false, reason: 'Item not found.' });
    }
    const maxSupply = craftRows[0].supplies;
    

    // 2. Count current ownerships for this metadata_cid
    const { count: currentSupply, error: ownershipCountError } = await supabase
      .from('Ownership')
      .select('id', { count: 'exact', head: true })
      .eq('metadata_cid', metadata_cid);

    if (ownershipCountError) {
      return res.status(500).json({ allowed: false, reason: 'Ownership count error.' });
    }

    // 3. Check if public_key already owns this item
    const { data: existingOwner, error: ownerError } = await supabase
      .from('Ownership')
      .select('id')
      .eq('metadata_cid', metadata_cid)
      .eq('owner_public_key', public_key)
      .limit(1);

    if (ownerError) {
      return res.status(500).json({ allowed: false, reason: 'Ownership check error.' });
    }

    const supplyCount = currentSupply ?? 0;
    if (supplyCount >= maxSupply) {
      return res.json({ allowed: false, reason: 'Max supply reached.' });
    }
    if (existingOwner && existingOwner.length > 0) {
      return res.json({ allowed: false, reason: 'Item already claimed by this public key.' });
    }

    return res.json({ allowed: true });
  } catch (err: any) {
    res.status(500).json({ allowed: false, reason: err.message });
  }
});


//POST /api/oath-signup: Store ed25519 identity signup data in Oath table
app.post('/api/oath-signup', async (req, res) => {
  try {
    const data = req.body;
    const { error } = await supabase.from('Oath').insert([data]);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// POST /api/oath-signin: Check credentials against Oath table (hashed PIN)
app.post('/api/oath-signin', async (req, res) => {
  const { unique_nickname, pin } = req.body;
  if (!unique_nickname || !pin) {
    return res.json({ success: false, error: "Missing nickname or PIN." });
  }

  // Fetch the user record by nickname
  const { data, error } = await supabase
    .from('Oath')
    .select('unique_nickname, pin')
    .eq('unique_nickname', unique_nickname)
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.json({ success: false, error: "Invalid credentials." });
  }

  const user = data[0];

  console.log('Entered nickname:', `"${unique_nickname}"`, 'Entered PIN:', `"${pin}"`);
  console.log('DB nickname:', `"${user.unique_nickname}"`, 'DB PIN:', `"${user.pin}"`);

  if (String(user.pin) !== String(pin)) {
    return res.json({ success: false, error: "Invalid credentials." });
  }

  //generate a session token
  const sessionToken = uuidv4();
  //store session key in supabase
  const { error: sessionError } = await supabase
    .from('Session')
    .insert([{ id: sessionToken, unique_nickname: user.unique_nickname }]);
  if (sessionError) {
    return res.status(500).json({ success: false, error: sessionError.message });
  }

  //set cookie
  res.cookie('session_token', sessionToken, { httpOnly: true, secure: false });

  return res.json({ success: true });
});


//this is logic for user context / session user
//this logic keep the nickname and public key sync to all pages (exclude preview)
//This endpoint is used to restore the authenticated user's context (nickname and public key) on every page load or reload.
app.get('/api/session-user', async (req, res) => {
  const sessionToken = req.cookies.session_token;
  if (!sessionToken) return res.status(401).json({ error: 'Not authenticated' });

  // Look up session in DB
  const { data: sessionRows, error: sessionError } = await supabase
    .from('Session')
    .select('unique_nickname')
    .eq('id', sessionToken)
    .limit(1);

  if (sessionError || !sessionRows || sessionRows.length === 0) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  const nickname = sessionRows[0].unique_nickname;

  // Fetch user info from Oath table
  const { data, error } = await supabase
    .from('Oath')
    .select('unique_nickname, public_key')
    .eq('unique_nickname', nickname)
    .limit(1);
  if (error || !data || data.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(data[0]);
});

//oath user
app.get('/api/oath-user', async (req, res) => {
  const { nickname } = req.query;
  if (!nickname) return res.status(400).json({ error: 'Missing nickname' });

  const { data, error } = await supabase
    .from('Oath')
    .select('unique_nickname, public_key')
    .eq('unique_nickname', nickname)
    .limit(1);

  if (error || !data || data.length === 0) {
    return res.status(404).json({ error: "User not found" });
  }
  res.json(data[0]);
});


//logout logic endpoint
app.post('/api/logout', async (req, res) => {
  const sessionToken = req.cookies.session_token;
  if (sessionToken) {
    await supabase.from('Session').delete().eq('id', sessionToken);
  }
  res.clearCookie('session_token');
  res.json({ success: true });
});

//============================================================================

//this is the logic for preview (crafter)
app.get('/api/crafter-ipors', async (req, res) => {
  const { public_key } = req.query;
  if (!public_key) return res.status(400).json([]);
  const { data, error } = await supabase
    .from('Craft')
    .select('*')
    .eq('crafter', public_key);
  if (error) return res.status(500).json([]);
  res.json(data);
});

//this is logic for preview too (owner)
// Get IPORs owned by owner
app.get('/api/owner-ipors', async (req, res) => {
  const { public_key } = req.query;
  console.log('Received public_key:', public_key);
  if (!public_key) return res.status(400).json([]);
  // Get all metadata_cid from Ownership table for this owner
  const { data: ownerships, error: ownerError } = await supabase
    .from('Ownership')
    .select('metadata_cid')
    .eq('owner_public_key', public_key);
  console.log('Ownerships:', ownerships);
  if (ownerError || !ownerships) return res.status(500).json([]);
  const cids = ownerships.map(o => o.metadata_cid);
  console.log('CIDs:', cids);

  // Get all IPORs from Craft table matching those cids
  if (cids.length === 0) return res.json([]);
  const { data: ipors, error: iporError } = await supabase
    .from('Craft')
    .select('*')
    .in('metadata_cid', cids);
  console.log('IPORs:', ipors);
  if (iporError || !ipors) return res.status(500).json([]);
  res.json(ipors);
});

//==============================================================================================

// Live query endpoint for crafter and ownership
app.get('/api/live-query', async (req, res) => {
  console.log("Live query endpoint called", req.query);

  const mode = req.query.mode as "crafter" | "ownership";
  const groupId = req.query.groupId as string;
  const fileId = req.query.fileId as string | undefined;

  if (!mode || !groupId) {
    return res.status(400).json({ error: "Missing mode or groupId" });
  }

  if (mode === "crafter") {
    try {
      const files = await getFilesInGroup(groupId);
      console.log("Files in group:", files);

      return res.json({
        mode: "crafter",
        total_files: files.length, // ✅ Add file count here
        files,
        message: "All files successfully retrieved for crafter group.",
      });
    } catch (err: any) {
      console.error("Error in live-query:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (mode === "ownership") {
    try {
      const files = await getFilesInGroup(groupId);

      // ✅ Apply external filter using fileId (not cid anymore)
      const match = files.find((f: any) => f.id === fileId);

      if (!match) {
        return res.json({
          verified: false,
          message: "Ownership file not found in this group.",
        });
      }

      return res.json({
        verified: true,
        mode: "ownership",
        file_id: fileId,
        cid: match.cid,
        file_name: match.name,
        uploaded_on: match.created_at,
        ipfs_url: `https://${process.env.GATEWAY_URL || "gateway.pinata.cloud"}/ipfs/${match.cid}`,
        message: "Ownership record verified by Owndrob.",
      });
    } catch (err: any) {
      console.error("Error in live-query:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: "Invalid mode" });
});



//log server start
app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
});