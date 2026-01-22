import NfcManager, { NfcTech, Ndef, NfcEvents, TagEvent } from 'react-native-nfc-manager';
import { Platform } from 'react-native';

export interface NFCTag {
  id: string;
  techTypes?: string[];
  ndefMessage?: NdefRecord[];
  maxSize?: number;
  isWritable?: boolean;
}

export interface NdefRecord {
  id?: string;
  tnf: number;
  type: string;
  payload: string;
}

export interface NFCError {
  code: string;
  message: string;
}

export type NFCSessionState = 'idle' | 'scanning' | 'writing' | 'success' | 'error';

class NFCManagerWrapper {
  private isInitialized = false;
  private sessionActive = false;

  /**
   * Initialize NFC Manager
   * Must be called before any NFC operations
   */
  async init(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      await NfcManager.start();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize NFC Manager:', error);
      return false;
    }
  }

  /**
   * Check if NFC is supported on the device
   */
  async isNFCSupported(): Promise<boolean> {
    try {
      return await NfcManager.isSupported();
    } catch (error) {
      console.error('Failed to check NFC support:', error);
      return false;
    }
  }

  /**
   * Check if NFC is enabled on the device
   */
  async isNFCEnabled(): Promise<boolean> {
    try {
      return await NfcManager.isEnabled();
    } catch (error) {
      console.error('Failed to check NFC enabled:', error);
      return false;
    }
  }

  /**
   * Open device NFC settings (Android only)
   */
  async openNFCSettings(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await NfcManager.goToNfcSetting();
      } catch (error) {
        console.error('Failed to open NFC settings:', error);
      }
    }
  }

  /**
   * Start an NFC session for reading tags
   * @param alertMessage - Message to display on iOS NFC prompt
   * @param onTagDiscovered - Callback when a tag is discovered
   */
  async startNFCSession(
    alertMessage: string = 'Approchez votre bracelet NFC',
    onTagDiscovered?: (tag: NFCTag) => void
  ): Promise<void> {
    if (this.sessionActive) {
      console.warn('NFC session already active');
      return;
    }

    try {
      await this.init();

      // Register tag discovered listener
      if (onTagDiscovered) {
        NfcManager.setEventListener(NfcEvents.DiscoverTag, (tag: TagEvent) => {
          const nfcTag = this.parseTagEvent(tag);
          onTagDiscovered(nfcTag);
        });
      }

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage,
      });

      this.sessionActive = true;
    } catch (error) {
      this.sessionActive = false;
      throw this.parseError(error);
    }
  }

  /**
   * Stop the current NFC session
   */
  async stopNFCSession(): Promise<void> {
    if (!this.sessionActive) {
      return;
    }

    try {
      // Remove event listeners
      NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
      NfcManager.setEventListener(NfcEvents.SessionClosed, null);

      // Cancel technology request
      await NfcManager.cancelTechnologyRequest();

      this.sessionActive = false;
    } catch (error) {
      console.error('Failed to stop NFC session:', error);
      this.sessionActive = false;
    }
  }

  /**
   * Read an NFC tag
   * @param alertMessage - Message to display on iOS NFC prompt
   * @param timeout - Optional timeout in milliseconds
   */
  async readTag(
    alertMessage: string = 'Approchez votre bracelet NFC',
    timeout?: number
  ): Promise<NFCTag> {
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      await this.init();

      // Set up timeout if specified
      const timeoutPromise = timeout
        ? new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              reject({ code: 'TIMEOUT', message: 'NFC scan timeout' });
            }, timeout);
          })
        : null;

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage,
      });

      this.sessionActive = true;

      // Read the tag
      const tag = await NfcManager.getTag();

      if (!tag) {
        throw { code: 'NO_TAG', message: 'No tag found' };
      }

      // Cancel timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Parse and return tag data
      const nfcTag = this.parseTagEvent(tag);

      // Close session
      await this.stopNFCSession();

      return nfcTag;
    } catch (error) {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      await this.stopNFCSession();
      throw this.parseError(error);
    }
  }

  /**
   * Write data to an NFC tag
   * @param message - The NDEF message to write
   * @param alertMessage - Message to display on iOS NFC prompt
   */
  async writeTag(
    message: string,
    alertMessage: string = 'Approchez votre bracelet NFC pour ecrire'
  ): Promise<NFCTag> {
    try {
      await this.init();

      // Request NFC technology with write capability
      await NfcManager.requestTechnology(NfcTech.Ndef, {
        alertMessage,
      });

      this.sessionActive = true;

      // Get current tag
      const tag = await NfcManager.getTag();

      if (!tag) {
        throw { code: 'NO_TAG', message: 'No tag found' };
      }

      // Create NDEF message
      const bytes = Ndef.encodeMessage([
        Ndef.textRecord(message),
      ]);

      if (!bytes) {
        throw { code: 'ENCODE_ERROR', message: 'Failed to encode NDEF message' };
      }

      // Write to tag
      await NfcManager.ndefHandler.writeNdefMessage(bytes);

      // Parse and return tag data
      const nfcTag = this.parseTagEvent(tag);

      // Close session with success message on iOS
      if (Platform.OS === 'ios') {
        await NfcManager.setAlertMessageIOS('Ecriture reussie!');
      }

      await this.stopNFCSession();

      return nfcTag;
    } catch (error) {
      await this.stopNFCSession();
      throw this.parseError(error);
    }
  }

  /**
   * Read tag UID only (faster than full NDEF read)
   * @param alertMessage - Message to display on iOS NFC prompt
   */
  async readTagUID(
    alertMessage: string = 'Approchez votre bracelet NFC'
  ): Promise<string> {
    try {
      await this.init();

      // Request NFC technology
      await NfcManager.requestTechnology(NfcTech.NfcA, {
        alertMessage,
      });

      this.sessionActive = true;

      // Get tag
      const tag = await NfcManager.getTag();

      if (!tag || !tag.id) {
        throw { code: 'NO_TAG', message: 'No tag found or tag has no ID' };
      }

      const uid = tag.id;

      await this.stopNFCSession();

      return uid;
    } catch (error) {
      await this.stopNFCSession();
      throw this.parseError(error);
    }
  }

  /**
   * Cancel the current NFC operation
   */
  async cancelOperation(): Promise<void> {
    await this.stopNFCSession();
  }

  /**
   * Clean up NFC Manager resources
   */
  async cleanup(): Promise<void> {
    await this.stopNFCSession();
    this.isInitialized = false;
  }

  /**
   * Parse NFC tag event to our NFCTag interface
   */
  private parseTagEvent(tag: TagEvent): NFCTag {
    const ndefRecords: NdefRecord[] = [];

    if (tag.ndefMessage) {
      for (const record of tag.ndefMessage) {
        ndefRecords.push({
          id: record.id ? this.bytesToString(record.id) : undefined,
          tnf: record.tnf,
          type: this.bytesToString(record.type),
          payload: this.bytesToString(record.payload),
        });
      }
    }

    return {
      id: tag.id || '',
      techTypes: tag.techTypes,
      ndefMessage: ndefRecords.length > 0 ? ndefRecords : undefined,
      maxSize: tag.maxSize,
      isWritable: tag.isWritable,
    };
  }

  /**
   * Convert byte array to string
   */
  private bytesToString(bytes: number[] | undefined): string {
    if (!bytes || bytes.length === 0) {
      return '';
    }

    try {
      // Skip the first byte for text records (language code length)
      const startIndex = bytes[0] === 0x02 ? 3 : 0;
      return String.fromCharCode(...bytes.slice(startIndex));
    } catch {
      return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  }

  /**
   * Parse error to consistent format
   */
  private parseError(error: any): NFCError {
    if (error?.code && error?.message) {
      return error as NFCError;
    }

    const errorMessage = error?.message || error?.toString() || 'Unknown NFC error';

    // Map common NFC errors
    if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
      return { code: 'CANCELLED', message: 'Operation cancelled by user' };
    }

    if (errorMessage.includes('timeout')) {
      return { code: 'TIMEOUT', message: 'NFC operation timed out' };
    }

    if (errorMessage.includes('not supported')) {
      return { code: 'NOT_SUPPORTED', message: 'NFC is not supported on this device' };
    }

    if (errorMessage.includes('disabled') || errorMessage.includes('not enabled')) {
      return { code: 'DISABLED', message: 'NFC is disabled. Please enable it in settings.' };
    }

    if (errorMessage.includes('tag lost') || errorMessage.includes('TagLost')) {
      return { code: 'TAG_LOST', message: 'Tag connection lost. Please try again.' };
    }

    if (errorMessage.includes('write') || errorMessage.includes('Write')) {
      return { code: 'WRITE_ERROR', message: 'Failed to write to tag. Tag may be read-only.' };
    }

    return { code: 'UNKNOWN', message: errorMessage };
  }

  /**
   * Check if a session is currently active
   */
  isSessionActive(): boolean {
    return this.sessionActive;
  }
}

// Export singleton instance
export const nfcManager = new NFCManagerWrapper();

// Export convenience functions
export const isNFCSupported = () => nfcManager.isNFCSupported();
export const isNFCEnabled = () => nfcManager.isNFCEnabled();
export const readTag = (alertMessage?: string, timeout?: number) =>
  nfcManager.readTag(alertMessage, timeout);
export const writeTag = (message: string, alertMessage?: string) =>
  nfcManager.writeTag(message, alertMessage);
export const readTagUID = (alertMessage?: string) =>
  nfcManager.readTagUID(alertMessage);
export const startNFCSession = (alertMessage?: string, onTagDiscovered?: (tag: NFCTag) => void) =>
  nfcManager.startNFCSession(alertMessage, onTagDiscovered);
export const stopNFCSession = () => nfcManager.stopNFCSession();
export const openNFCSettings = () => nfcManager.openNFCSettings();
export const cancelNFCOperation = () => nfcManager.cancelOperation();
