import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { uploadIPORFile, updateIPORFile, createOwningGroup } from './Pinata.ts';
import type { Metadata } from './Pinata.ts';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// POST /api/ipor-file: Create a file with metadata only on Pinata
app.post('/api/ipor-file', async (req, res) => {
  console.log('Received body:', req.body);
  try {
    const { metadata } = req.body;
    if (!metadata) {
      return res.status(400).json({ error: 'Missing metadata' });
    }
    const result = await uploadIPORFile(metadata as Metadata);

    //save result and metadata to Craft table in supabase
    const { error: dbError } = await supabase
      .from('Craft')
      .insert([
        {
          metadata_cid: result.metadataCID,
          metadata_file_id: result.metadataFileId,
          ...metadata
        }
      ]);

    if (dbError) {
      console.error('❌ Supabase insert error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    res.json(result);
  } catch (err: any) {
    console.error('❌ Error in /api/ipor-file:', err);
    res.status(500).json({ error: err.message });
  }
});

//update file id
app.post('/api/ipor-file', async (req, res) => {
  try {
    const { metadata } = req.body;
    if (!metadata) {
      return res.status(400).json({ error: 'Missing metadata' });
    }

    // 1. Upload metadata to Pinata
    const result = await uploadIPORFile(metadata);

    // 2. Immediately update file name and keyvalues in Pinata
    await updateIPORFile(metadata, result.metadataFileId);

    // 3. Save result and metadata to Craft table in Supabase
    const { error: dbError } = await supabase
      .from('Craft')
      .insert([
        {
          metadata_cid: result.metadataCID,
          metadata_file_id: result.metadataFileId,
          ...metadata
        }
      ]);

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


//ipor registry
app.post('/api/register-ownership', async (req, res) => {
  try {
    const { owner_public_key, metadata_cid, metadata_file_id } = req.body;
    if (!owner_public_key || !metadata_cid) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }
    const signature_key = uuidv4();
    const status = true;
    const timestamp = new Date().toISOString();

    const { error } = await supabase.from('Ownership').insert([{
      owner_public_key,
      signature_key,
      metadata_cid,
      metadata_file_id,
      status,
      timestamp,
    }]);
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


//============================================================================================
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

  return res.json({ success: true });
});


app.get('/api/oath-user', async (req, res) => {
  const { nickname } = req.query;
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


//log server start
app.listen(PORT, () => {
  console.log(`🚀 Backend API running on http://localhost:${PORT}`);
});