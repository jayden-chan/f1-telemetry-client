// tslint:disable-next-line
import {Parser} from 'binary-parser';
import * as dgram from 'dgram';
import {EventEmitter} from 'events';
import {AddressInfo} from 'net';

import * as constants from './constants';
import * as constantsTypes from './constants/types';
import {PacketCarSetupDataParser, PacketCarStatusDataParser, PacketCarTelemetryDataParser, PacketEventDataParser, PacketFinalClassificationDataParser, PacketFormatParser, PacketHeaderParser, PacketLapDataParser, PacketLobbyInfoDataParser, PacketMotionDataParser, PacketParticipantsDataParser, PacketSessionDataParser,} from './parsers/packets';
import * as packetTypes from './parsers/packets/types';
import {Options} from './types';

const DEFAULT_PORT = 20777;
const BIGINT_ENABLED = true;

export interface F1TelemetryClientEvents {
  motion: (data: packetTypes.PacketMotionData) => void;
  session: (data: packetTypes.PacketSessionData) => void;
  lapData: (data: packetTypes.PacketLapData) => void;
  event: (data: packetTypes.PacketEventData) => void;
  participants: (data: packetTypes.PacketParticipantsData) => void;
  carSetups: (data: packetTypes.PacketCarSetupData) => void;
  carTelemetry: (data: packetTypes.PacketCarTelemetryData) => void;
  carStatus: (data: packetTypes.PacketCarStatusData) => void;
  finalClassification:
      (data: packetTypes.PacketFinalClassificationData) => void;
  lobbyInfo: (data: packetTypes.PacketLobbyInfoData) => void;
}

export declare interface F1TelemetryClient {
  on<U extends keyof F1TelemetryClientEvents>(
      event: U, listener: F1TelemetryClientEvents[U]): this;

  emit<U extends keyof F1TelemetryClientEvents>(
      event: U, ...args: Parameters<F1TelemetryClientEvents[U]>): boolean;
}

/**
 *
 */
export class F1TelemetryClient extends EventEmitter {
  port: number;
  bigintEnabled: boolean;
  client?: dgram.Socket;

  constructor(opts: Options = {}) {
    super();

    const {port = DEFAULT_PORT, bigintEnabled = BIGINT_ENABLED} = opts;

    this.port = port;
    this.bigintEnabled = bigintEnabled;
    this.client = dgram.createSocket('udp4');
  }

  /**
   *
   * @param {Buffer} buffer
   */
  static parsePacketHeader(
      buffer: Buffer, bigintEnabled: boolean
      // tslint:disable-next-line:no-any
      ): Parser.Parsed<any> {
    const packetFormatParser = new PacketFormatParser();
    const {m_packetFormat} = packetFormatParser.fromBuffer(buffer);
    const packetHeaderParser =
        new PacketHeaderParser(m_packetFormat, bigintEnabled);
    return packetHeaderParser.fromBuffer(buffer);
  }

  /**
   *
   * @param {Number} packetId
   */
  static getParserByPacketId(packetId: number) {
    const {PACKETS} = constants;

    const packetKeys = Object.keys(PACKETS);
    const packetType = packetKeys[packetId];

    switch (packetType) {
      case PACKETS.session:
        return PacketSessionDataParser;

      case PACKETS.motion:
        return PacketMotionDataParser;

      case PACKETS.lapData:
        return PacketLapDataParser;

      case PACKETS.event:
        return PacketEventDataParser;

      case PACKETS.participants:
        return PacketParticipantsDataParser;

      case PACKETS.carSetups:
        return PacketCarSetupDataParser;

      case PACKETS.carTelemetry:
        return PacketCarTelemetryDataParser;

      case PACKETS.carStatus:
        return PacketCarStatusDataParser;

      case PACKETS.finalClassification:
        return PacketFinalClassificationDataParser;

      case PACKETS.lobbyInfo:
        return PacketLobbyInfoDataParser;

      default:
        return null;
    }
  }

  /**
   *
   * @param {Buffer} message
   */
  parseMessage(message: Buffer) {
    const {m_packetFormat, m_packetId} =
        F1TelemetryClient.parsePacketHeader(message, this.bigintEnabled);

    const parser = F1TelemetryClient.getParserByPacketId(m_packetId);

    if (!parser) {
      return;
    }

    const packetData = new parser(message, m_packetFormat, this.bigintEnabled);
    const packetKeys =
        Object.keys(constants.PACKETS) as Array<keyof typeof constants.PACKETS>;

    // @ts-ignore
    this.emit(packetKeys[m_packetId], packetData.data);
  }

  /**
   * Method to start listening for packets
   */
  start() {
    if (!this.client) {
      return;
    }

    this.client.on('listening', () => {
      if (!this.client) {
        return;
      }

      const address = this.client.address() as AddressInfo;
      console.log(
          `UDP Client listening on ${address.address}:${address.port} 🏎`);
      this.client.setBroadcast(true);
    });

    this.client.on('message', (m) => this.parseMessage(m));
    this.client.bind(this.port);
  }

  /**
   * Method to close the client
   */
  stop() {
    if (!this.client) {
      return;
    }

    return this.client.close(() => {
      console.log(`UDP Client closed 🏁`);
      this.client = undefined;
    });
  }
}

export {constants, constantsTypes, packetTypes, DEFAULT_PORT};
