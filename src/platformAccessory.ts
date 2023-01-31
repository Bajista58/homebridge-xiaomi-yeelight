import { CharacteristicValue, Service } from 'homebridge';
import { XiaomiYeelightPlatform } from './platform';
import miio from '@svyatogor/miio-yeelight-x';
import { LightCharacteristics, MiLightPlatformAccesory } from './models';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */

export class Light {
  private lightCharacteristics: LightCharacteristics;
  private connection: miio;

  private state = {
    hue: 0,
    saturation: 0,
  };

  private configs = {
    minTemp: 154,
    maxTemp: 370,
  };

  constructor(
    private readonly platform: XiaomiYeelightPlatform,
    private readonly accessory: MiLightPlatformAccesory,
  ) {
    miio
      .device({
        address: accessory.context.device.ipAddress,
        token: accessory.context.device.token,
      })
      .then((device) => {
        this.connection = device;

        const colorTempSupport = this.connection.matches(
          'cap:colorable',
          'cap:color:temperature',
        );
        const colorSupport = this.connection.matches(
          'cap:colorable',
          'cap:color:full',
        );
        const brightnessSupport = this.connection.matches(
          'cap:dimmable',
          'cap:brightness',
        );

        const nightmodeSupport = this.connection.matches('cap:miio:nightmode');

        this.platform.log.info('opened connection to device', device);

        if (colorTempSupport) {
          this.lightCharacteristics.colorTmp = service
            .getCharacteristic(this.platform.Characteristic.ColorTemperature)
            .setProps({
              maxValue: this.configs.maxTemp,
              minValue: this.configs.minTemp,
            })
            .onSet(this.setColorTemperature.bind(this));

          this.connection.on('colorChanged', (colorTmp) => {
            if (
              colorTmp.model !== 'temperature' &&
              colorTmp.model !== 'mired'
            ) {
              return;
            }

            const tmp = Math.min(
              Math.max(colorTmp.mired.value, this.configs.minTemp),
              this.configs.maxTemp,
            );

            if (this.lightCharacteristics.colorTmp) {
              this.lightCharacteristics.colorTmp.updateValue(tmp);

              this.updateHueAndSaturation(colorTmp);
            }
          });
        }

        if (colorSupport) {
          this.lightCharacteristics.hue = service
            .getCharacteristic(this.platform.Characteristic.Hue)
            .onSet(this.setHue.bind(this));

          this.lightCharacteristics.sat = service
            .getCharacteristic(this.platform.Characteristic.Saturation)
            .onSet(this.setSaturation.bind(this));

          this.connection.on('colorChanged', (color) => {
            if (color.model === 'temperature' || color.model === 'mired') {
              return;
            }
            if (this.lightCharacteristics.colorTmp) {
              this.lightCharacteristics.colorTmp.updateValue(
                this.configs.minTemp,
              );
            }
            this.updateHueAndSaturation(color);
          });
        }

        if (brightnessSupport) {
          this.lightCharacteristics.brightness = service
            .getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setBrightness.bind(this));

          this.connection.on('brightnessChanged', (bright) => {
            if (this.lightCharacteristics.brightness) {
              this.lightCharacteristics.brightness.updateValue(bright);
            }
          });
        }

        if (nightmodeSupport) {
          const moonlight =
            this.accessory.getService(
              `${accessory.context.device.name} Moonlight`,
            ) ||
            this.accessory.addService(
              this.platform.Service.Lightbulb,
              `${accessory.context.device.name} Moonlight`,
              accessory.UUID,
              'moonlight'
            );

          this.lightCharacteristics.moonlight = moonlight
            .getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setMoonLight.bind(this));

          this.lightCharacteristics.moonlightBrightness = moonlight
            .getCharacteristic(this.platform.Characteristic.Brightness)
            .onSet(this.setMoonLightBrightness.bind(this));

          this.connection.on('modeChanged', (mode) => {
            this.lightCharacteristics.moonlight?.updateValue(mode === 'moonlight');
          });

          this.connection.on('updateMoonlightBrightness', (bright) => {
            this.lightCharacteristics.moonlightBrightness?.updateValue(bright);
          });
        }

        this.connection.on('powerChanged', (power) => {
          this.lightCharacteristics.power.updateValue(power)
        });
      })
      .catch((e) => this.platform.log.error(e));

    // set accessory information
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Xiaomi')
      .setCharacteristic(this.platform.Characteristic.Model, 'Yeelight');

    const service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb);

    service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

    this.lightCharacteristics = {
      power: service
        .getCharacteristic(this.platform.Characteristic.On)
        .onSet(this.setOn.bind(this)),
    };
  }

  get debugLogging(): boolean {
    return this.platform.config.debugLogging;
  }

  async setOn(value: CharacteristicValue) {
    if (this.debugLogging) {
      this.platform.log.info('setting power to', value);
    }

    try {
      await this.connection.setPower(value);

      if (this.debugLogging) {
        this.platform.log.info('power set successfully');
      }
    } catch (e: any) {
      this.platform.log.error(e);
    }
  }

  async setBrightness(value: CharacteristicValue) {
    if (this.debugLogging) {
      this.platform.log.info('setting brightness to', value);
    }

    try {
      await this.connection.setBrightness(value);

      if (this.debugLogging) {
        this.platform.log.info('brightness set successfully');
      }
    } catch (e: any) {
      this.platform.log.error(e);
    }
  }

  async setColorTemperature(value: CharacteristicValue) {
    const kelvin = `${Math.round(1000000 / (value as number))}K`;

    if (this.debugLogging) {
      this.platform.log.info(
        'setting color temp:',
        'mired =',
        value,
        'kelvin =',
        kelvin,
      );
    }

    try {
      await this.connection.color(kelvin);
      if (this.debugLogging) {
        this.platform.log.info('color temp set successfully');
      }
    } catch (e: any) {
      this.platform.log.error(e);
    }
  }

  async setHue(value: CharacteristicValue) {
    const oldHue = this.state.hue;
    this.state.hue = value as number;
    if (this.debugLogging) {
      this.platform.log.info('setting hue to', value);
    }

    try {
      await this.connection.color(
        `hsl(${this.state.hue}, ${this.state.saturation}%, 100%)`,
      );
      if (this.debugLogging) {
        this.platform.log.info('hue set successfully');
      }
    } catch (e: any) {
      this.state.hue = oldHue;
      this.platform.log.error(e);
    }
  }

  async setSaturation(value: CharacteristicValue) {
    const oldSat = this.state.saturation;
    this.state.saturation = value as number;
    if (this.debugLogging) {
      this.platform.log.info('setting saturation to', value);
    }

    try {
      await this.connection.color(
        `hsl(${this.state.hue}, ${this.state.saturation}%, 100%)`,
      );
      if (this.debugLogging) {
        this.platform.log.info('saturation set successfully');
      }
    } catch (e: any) {
      this.state.saturation = oldSat;
      this.platform.log.error(e);
    }
  }

  async setMoonLight(value: CharacteristicValue) {
    if (value) {
      await this.connection.changeMode('moonlight')
    } else {
      await this.connection.setPower(false)
    }
  }


  async setMoonLightBrightness(value: CharacteristicValue) {
    this.setBrightness(value)
  }

  async startColorFlow() {
    try {
      const props = await this.connection.loadProperties(['flowing']);

      if (props.flowing === '1') {
        await this.connection.call('stop_cf');
        return;
      }

      const colors = [
        255 * 65536 + 36 * 256 + 0,
        232 * 65536 + 29 * 256 + 29,
        232 * 65536 + 183 * 256 + 29,
        227 * 65536 + 232 * 256 + 29,
        29 * 65536 + 232 * 256 + 64,
        29 * 65536 + 221 * 256 + 232,
        43 * 65536 + 29 * 256 + 232,
        221 * 65536 + 0 * 256 + 243,
      ];

      const tuples = colors.map((color) => `2250,1,${color},100`);

      await this.connection.call('set_scene', ['cf', 0, 0, tuples.join(', ')]);
    } catch (e: any) {
      this.platform.log.error(e);
    }
  }

  private updateHueAndSaturation(color) {
    color = color.hsv;

    if (this.lightCharacteristics.hue) {
      this.state.hue = color.hue;
      this.lightCharacteristics.hue.updateValue(color.hue);
    }

    if (this.lightCharacteristics.sat) {
      this.state.saturation = color.saturation;
      this.lightCharacteristics.sat.updateValue(color.saturation);
    }
  }
}
