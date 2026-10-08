# Download and install on CachyOS or Ubuntu

OMMI SISSI is a self-hosted digital signage server. Run these commands in a terminal as your normal user. Internet access is required to download the code and dependencies. The same source release works on both distributions; native dependencies are installed for your own machine.

## 1. Install prerequisites

### CachyOS / Arch Linux

```bash
sudo pacman -Syu --needed git nodejs-lts-krypton npm base-devel python ffmpeg
```

This uses the [Arch Node.js 24 LTS package](https://archlinux.org/packages/extra/x86_64/nodejs-lts-krypton/). FFmpeg provides video metadata and thumbnails.

### Ubuntu / Debian

Install build tools, then Node.js 24 LTS with [nvm](https://github.com/nvm-sh/nvm). Ubuntu's default Node.js package may be older than the required 22.12, so use the commands below.

```bash
sudo apt-get update
sudo apt-get install -y git curl ca-certificates build-essential python3 ffmpeg unzip
curl -fsSLo /tmp/ommi-nvm-install.sh https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh
bash /tmp/ommi-nvm-install.sh
export NVM_DIR="${XDG_CONFIG_HOME:-$HOME}/.nvm"
. "$NVM_DIR/nvm.sh"
nvm install 24
nvm alias default 24
```

Skip installing nvm if you already have a supported Node.js version and npm. Node.js 24 LTS is recommended; see [Node.js downloads](https://nodejs.org/en/download).

Check both commands succeed before continuing:

```bash
node --version
npm --version
```

## 2. Download the project

Using Git:

```bash
git clone https://github.com/ACHRAF012006/ommi-sissi-signage.git
cd ommi-sissi-signage
```

Or [download the ZIP](https://github.com/ACHRAF012006/ommi-sissi-signage/archive/refs/heads/main.zip), extract it, and open a terminal in the extracted folder. [Releases](https://github.com/ACHRAF012006/ommi-sissi-signage/releases) provide versioned source downloads.

## 3. Install and start

```bash
chmod +x install.sh start.sh stop.sh toggle-autostart.sh
./install.sh
./start.sh
```

The installer downloads locked production dependencies, creates the folders, generates a unique session secret in `.env`, initializes an empty SQLite database, and asks you to create your administrator username and password. Existing settings and data are preserved when reinstalling. If you skip account creation, run `npm run create-admin` before logging in.

Open **http://localhost:3000/** on the server, or **http://SERVER-IP:3000/** from another computer on the same network. Administration is at `/admin`; TV setup is at `/display`. Allow TCP port 3000 through your firewall for other devices.

Keep the terminal open while the server runs. Stop it with Ctrl+C or `./stop.sh`.

## 4. Optional: start at boot

On a machine running systemd:

```bash
./toggle-autostart.sh on
./stop.sh
./start.sh
```

This creates a service for your user and installation path, including the absolute Node.js path. With nvm, regenerate the service if you later remove or move that Node.js installation. See the [full README](../README.md) for service management.

## Updates and personal data

Back up your installation with `npm run backup` before updating. For a Git checkout:

```bash
./stop.sh
git pull --ff-only
./install.sh
./start.sh
```

The public download contains source code, static assets, and test screenshots. Each installation creates its own `.env`, accounts, database, and media library. Settings, databases, uploads, logs, and backups are ignored by Git. To transfer an existing installation, follow [Moving application to another computer](../README.md#moving-application-to-another-computer).

## Development and tests

The installer omits development dependencies. Install them before running tests:

```bash
npm ci
npm test
```

Browser tests additionally require Playwright Chromium and FFmpeg; see [Testing](../README.md#testing).
