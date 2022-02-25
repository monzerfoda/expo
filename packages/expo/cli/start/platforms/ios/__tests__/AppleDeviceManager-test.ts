import { CommandError } from '../../../../utils/errors';
import { Device, getContainerPathAsync, openAppIdAsync, openUrlAsync } from '../simctl';
import { AppleDeviceManager } from '../AppleDeviceManager';

const asMock = <T extends (...args: any[]) => any>(fn: T): jest.MockedFunction<T> =>
  fn as jest.MockedFunction<T>;

jest.mock('@expo/spawn-async');

jest.mock('../simctl', () => ({
  openAppIdAsync: jest.fn(),
  openUrlAsync: jest.fn(),
  getContainerPathAsync: jest.fn(
    () =>
      '/Users/evanbacon/Library/Developer/CoreSimulator/Devices/EFEEA6EF-E3F5-4EDE-9B72-29EAFA7514AE/data/Containers/Bundle/Application/FA43A0C6-C2AD-442D-B8B1-EAF3E88CF3BF/Exponent-2.23.2.tar.app'
  ),
}));

const asDevice = (device: Partial<Device>): Device => device as Device;

function createDevice() {
  return new AppleDeviceManager(asDevice({ name: 'iPhone 13', udid: '123' }));
}

describe('getAppVersionAsync', () => {
  it(`gets the version from an installed app`, async () => {
    const device = createDevice();
    asMock(getContainerPathAsync).mockClear();
    await expect(device.getAppVersionAsync('host.exp.Exponent')).resolves.toBe('2.23.2');
    expect(getContainerPathAsync).toHaveBeenCalledWith(
      { name: 'iPhone 13', udid: '123' },
      { appId: 'host.exp.Exponent' }
    );
  });
  it(`asserts that only Expo Go is supported`, async () => {
    const device = createDevice();
    await expect(device.getAppVersionAsync('foobar')).rejects.toThrow(/Expo Go/);
  });
  it(`returns null when the app is not installed`, async () => {
    const device = createDevice();
    asMock(getContainerPathAsync).mockClear().mockResolvedValueOnce(null);
    await expect(device.getAppVersionAsync('host.exp.Exponent')).resolves.toBe(null);
  });
});

describe('launchApplicationIdAsync', () => {
  it(`asserts that the app is not installed`, async () => {
    const device = createDevice();
    asMock(openAppIdAsync).mockImplementationOnce(() => {
      throw new CommandError('APP_NOT_INSTALLED', '...');
    });
    await expect(device.launchApplicationIdAsync('host.exp.Exponent')).rejects.toThrow(/run:ios/);
  });
  it(`asserts unknown error`, async () => {
    const device = createDevice();
    asMock(openAppIdAsync).mockResolvedValueOnce({ status: 1 } as any);
    await expect(device.launchApplicationIdAsync('host.exp.Exponent')).rejects.toThrow(
      /Couldn't open iOS app with ID/
    );
  });
  it(`opens the app by ID and activates the window.`, async () => {
    const device = createDevice();
    device.activateWindowAsync = jest.fn();
    asMock(openAppIdAsync).mockResolvedValueOnce({ status: 0 } as any);
    await device.launchApplicationIdAsync('host.exp.Exponent');
    expect(device.activateWindowAsync).toBeCalled();
  });
  it(`asserts that an unexpected error occurred`, async () => {
    const device = createDevice();
    asMock(openAppIdAsync).mockImplementationOnce(() => {
      throw new Error('...');
    });
    await expect(device.launchApplicationIdAsync).rejects.toThrow(/\.\.\./);
  });
});

describe('openUrlAsync', () => {
  it('launches into Expo Go', async () => {
    asMock(openUrlAsync).mockClear();
    const device = createDevice();
    await device.openUrlAsync('exp://foobar');
    expect(openUrlAsync).toBeCalledWith(
      { name: 'iPhone 13', udid: '123' },
      { url: 'exp://foobar' }
    );
  });
  it('opens a URL on a device', async () => {
    asMock(openUrlAsync).mockClear();
    asMock(openAppIdAsync).mockClear();
    const device = createDevice();
    await device.openUrlAsync('http://foobar');
    expect(openAppIdAsync).not.toBeCalled();
    expect(openUrlAsync).toBeCalledWith(
      { name: 'iPhone 13', udid: '123' },
      { url: 'http://foobar' }
    );
  });
  it('launches nonstandard URL', async () => {
    const device = createDevice();
    device.launchApplicationIdAsync = jest.fn(async () => {});
    await device.openUrlAsync('@foobar');
    expect(device.launchApplicationIdAsync).toHaveBeenCalledWith('@foobar');
  });
});
