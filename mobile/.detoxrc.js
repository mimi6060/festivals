/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 120000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Festivals.app',
      build: 'xcodebuild -workspace ios/Festivals.xcworkspace -scheme Festivals -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Festivals.app',
      build: 'xcodebuild -workspace ios/Festivals.xcworkspace -scheme Festivals -configuration Release -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/release/app-release.apk',
      build: 'cd android && ./gradlew assembleRelease assembleAndroidTest -DtestBuildType=release',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15 Pro',
      },
    },
    'simulator.iphone14': {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14',
      },
    },
    'simulator.ipad': {
      type: 'ios.simulator',
      device: {
        type: 'iPad Pro (12.9-inch) (6th generation)',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_6_API_33',
      },
    },
    'emulator.pixel5': {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_5_API_31',
      },
    },
    attached: {
      type: 'android.attached',
      device: {
        adbName: '.*',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'ios.iphone14.debug': {
      device: 'simulator.iphone14',
      app: 'ios.debug',
    },
    'ios.ipad.debug': {
      device: 'simulator.ipad',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
    'android.emu.release': {
      device: 'emulator',
      app: 'android.release',
    },
    'android.pixel5.debug': {
      device: 'emulator.pixel5',
      app: 'android.debug',
    },
    'android.att.debug': {
      device: 'attached',
      app: 'android.debug',
    },
  },
  artifacts: {
    rootDir: './e2e/artifacts',
    plugins: {
      screenshot: {
        enabled: true,
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: {
          testStart: false,
          testDone: true,
        },
      },
      video: {
        enabled: false,
      },
      log: {
        enabled: true,
      },
      uiHierarchy: {
        enabled: true,
      },
    },
  },
  behavior: {
    init: {
      exposeGlobals: true,
      reinstallApp: true,
    },
    launchApp: 'auto',
    cleanup: {
      shutdownDevice: false,
    },
  },
  session: {
    autoStart: true,
    debugSynchronization: 10000,
    server: 'ws://localhost:8099',
    sessionId: 'festivals-e2e',
  },
};
