# Fire TV DevTools

A desktop tool for controlling and managing Fire TV devices over ADB. Built because I got tired of juggling the physical remote and adb commands while testing apps.

## What it does

- Remote control through your computer (arrow keys, home, back, etc.)
- Device connection management with IP addresses
- App listing and launching
- APK installation
- Text input (way easier than the on-screen keyboard)
- Auto-reconnect when devices go offline

## Requirements

- ADB installed and in your PATH
- Fire TV with developer options enabled
- Both devices on the same network

## Setup

Enable ADB debugging on your Fire TV:
1. Go to Settings > My Fire TV > Developer Options
2. Turn on ADB Debugging
3. Note your Fire TV's IP address (Settings > My Fire TV > About > Network)

Then just run the app and connect using that IP.

## Dev stuff

Built with Electron. The UI is frameless/transparent for that custom look.

```bash
npm install
npm start
```

Use `npm start -- --dev` to open DevTools.

## Issues

If commands stop working, hit reconnect. Sometimes the ADB connection times out or the device goes to sleep.

The app keeps both old and new versions of some IPC handlers for backward compatibility, but you should use the `-enhanced` versions when possible since they have better error handling.

## License

Do whatever you want with it. Nothing I do should be gatekept.
