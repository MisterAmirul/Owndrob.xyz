import dotenv from 'dotenv';
import axios from 'axios';
import { PinataSDK } from "pinata";

dotenv.config();

const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.GATEWAY_URL!
});


export interface Metadata {
  ipor_name: string;
  version: string;
  description: string;
  supplies: number;
  color: string;
  manufacturing_country: string;
  value: number;
  label: string;
  provider: string;
}

// 1. Upload a file and its metadata to Pinata (file level)
export async function uploadIPORFile(metadata: Metadata) {
  const metadataUpload = await pinata.upload.public.json(metadata);
  const metadataCID = metadataUpload.cid;
  const metadataFileId = metadataUpload.id;
  return { metadataCID, metadataFileId };
}


// 2. Create a group only (after each IPOR creation)
export async function createOwningGroup(groupName: string) {
  const group = await pinata.groups.public.create({ name: groupName });
  return {
    group_id: group.id,
    name: group.name,
    created_at: group.createdAt
  };
}


// 3. Upload Ownership Record to Pinata (file level)
export async function uploadOwnershipRecord(ownershipRecord: {
  metadata_cid: string,
  metadata_file_id: string,
  owner_public_key: string,
  signature_key: string,
  timestamp: string
}) {
  const ownershipUpload = await pinata.upload.public.json(ownershipRecord);
  return {
    ownership_cid: ownershipUpload.cid,
    ownership_file_id: ownershipUpload.id
  };
}


// Add a ownership file to a group (used for both IPOR and ownership records)
export async function addOwnershipFileToGroup(groupId: string, ownership_file_id: string) {
  const addResult = await pinata.groups.public.addFiles({
    groupId,
    files: [ownership_file_id]
  });
  return addResult; // array of { id, status }
}

// Crafter query: get all files in a group
export async function getFilesInGroup(groupId: string) {
  const files = await pinata.files.public.list().group(groupId);
  return files.files;
}



