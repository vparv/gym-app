import { Asset } from 'expo-asset';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

export async function loadBundledCsvTextAsync(assetModule: number) {
  const asset = Asset.fromModule(assetModule);

  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    return await response.text();
  }

  await asset.downloadAsync();

  const localUri = asset.localUri ?? asset.uri;

  if (!localUri) {
    throw new Error('The bundled workout program could not be resolved.');
  }

  return await new ExpoFile(localUri).text();
}

export async function readPickedDocumentTextAsync(asset: DocumentPickerAsset) {
  if (Platform.OS === 'web' && asset.file) {
    return await asset.file.text();
  }

  return await new ExpoFile(asset.uri).text();
}
