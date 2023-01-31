import {
  AccessoryName,
  API,
  Characteristic,
  DynamicPlatformPlugin,
  IndependentPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  PlatformName,
  StaticPlatformPlugin,
} from 'homebridge';

export interface LightCharacteristics {
  power: Characteristic;
  colorTmp?: Characteristic;
  brightness?: Characteristic;
  hue?: Characteristic;
  sat?: Characteristic;
  moonlight?: Characteristic;
  moonlightBrightness?: Characteristic;
}

export interface MiLightSettings {
  name: string;
  ipAddress: string;
  token: string;
}

export interface MiLightContext {
  device: MiLightSettings;
}

export type MiLightPlatformAccesory = PlatformAccessory<MiLightContext>;

export interface MiAPI extends API {
  registerPlatform(
    accessoryName: AccessoryName,
    platformName: PlatformName,
    constructor: MiPlatformPluginConstructor,
  ): void;

  registerPlatform(
    platformName: PlatformName,
    constructor: MiPlatformPluginConstructor,
  ): void;
}

export interface MiPlatformPluginConstructor {
  new (logger: Logging, config: MiPlatformConfig, api: MiAPI):
    | DynamicPlatformPlugin
    | StaticPlatformPlugin
    | IndependentPlatformPlugin;
}

type RemoveRecord<T> = {
  [K in keyof T as string extends K ? never : K]: T[K];
};

export type MiPlatformConfig = RemoveRecord<PlatformConfig> & {
  debugLogging: boolean;
  lights: MiLightSettings[];
};
