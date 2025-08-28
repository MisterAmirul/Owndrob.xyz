import { PinataSDK } from 'pinata';
import dotenv from 'dotenv';


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
  // Upload metadata as a JSON file to Pinata
  const metadataUpload = await pinata.upload.public.json(metadata);
  const metadataCID = metadataUpload.cid;
  const metadataFileId = metadataUpload.id;

  return { metadataCID, metadataFileId };
}

// 2. rename a file use file id (keyvalue)
export async function updateIPORFile(metadata: Metadata, fileId: string) {
  const update = await pinata.files.public.update({
    name: metadata.ipor_name,
    id: fileId,
    keyvalues: {
      [metadata.label]: String(metadata.value)
    }
  });
  console.log('Pinata update result:', update);
  return update;
}


// 3. Create a group and add files to it (group level)
export async function createOwningGroup(groupName: string, fileIds: string[]) {
  // Create the group
  const group = await pinata.groups.public.create({ name: groupName });

  // Add files to the group
  await pinata.groups.public.addFiles({
    groupId: group.id,
    files: fileIds
  });

  return {
    group: {
      id: group.id,
      name: group.name,
      created_at: group.createdAt
    },
    files: fileIds
  };
}