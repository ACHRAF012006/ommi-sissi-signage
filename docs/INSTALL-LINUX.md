# Download and install on CachyOS or Ubuntu

OMMI SISSI is a self-hosted digital signage server. Run these commands in a terminal as your normal user. Internet access is required to download the code and dependencies. The same source release works on both distributions; native dependencies are installed for your own machine.

## 0. Install Git first

Download [install-git.sh](https://raw.githubusercontent.com/ACHRAF012006/ommi-sissi-signage/main/install-git.sh) in your browser, then open a terminal in the download folder:

```bash
bash install-git.sh
```

The standalone script needs no Node.js or project files. It detects CachyOS/Arch or Ubuntu/Debian and installs Git if missing, using sudo when needed. `./install.sh` also runs this check before installing application dependencies, including for ZIP downloads.

Alternatively, install Git directly:

```bash
# CachyOS / Arch
sudo pacman -Syu --needed git
```

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install -y git
```

## 1. Install remaining prerequisites

### CachyOS / Arch Linux

```bash
sudo pacman -Syu --needed nodejs-lts-krypton npm base-devel python ffmpeg
```

This uses the [Arch Node.js 24 LTS package](https://archlinux.org/packages/extra/x86_64/nodejs-lts-krypton/). FFmpeg provides video metadata and thumbnails.

### Ubuntu / Debian

Install build tools, then Node.js 24 LTS with [nvm](https://github.com/nvm-sh/nvm). Ubuntu's default Node.js package may be older than the required 22.12, so use the commands below.

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates build-essential python3 ffmpeg unzip
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

On CachyOS / Arch, install Git before cloning:

```bash
sudo pacman -Syu --needed git
git clone https://github.com/ACHRAF012006/ommi-sissi-signage.git
cd ommi-sissi-signage
```

On Ubuntu / Debian, install Git before cloning:

```bash
sudo apt-get update
sudo apt-get install -y git
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

The installer downloads locked production dependencies, creates the folders, generates a unique session secret in `.env`, initializes an empty SQLite database, asks you to create your administrator username and password, and **enables startup at boot by default** using systemd. It may ask for your sudo password to install and enable the service. Existing settings and data are preserved when reinstalling. If you skip account creation, run `npm run create-admin` before logging in.

Open **http://localhost:3000/** on the server, or **http://SERVER-IP:3000/** from another computer on the same network. Administration is at `/admin`; TV setup is at `/display`. Allow TCP port 3000 through your firewall for other devices.

After installation, `./start.sh` starts the service in the background. It will also start automatically after reboot. Stop it with `./stop.sh`; this leaves startup at boot enabled.

## 4. Manage startup at boot

Startup at boot is enabled during installation. Check or change it with:

```bash
./toggle-autostart.sh status
./toggle-autostart.sh off     # Disable startup at boot
./toggle-autostart.sh on      # Enable it again
```

This creates a service for your user and installation path, including the absolute Node.js path. With nvm, regenerate the service if you later remove or move that Node.js installation. See the [full README](../README.md) for service management.

For a manual installation, or a container without systemd, run `./install.sh --no-autostart`. This skips service configuration and preserves any existing startup setting. Without a configured service, `./start.sh` runs in the foreground; keep its terminal open. A default installation reports failure if service setup fails, rather than reporting that startup at boot is enabled.

When updating a manual installation, use `./install.sh --no-autostart` again to keep skipping service setup.

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
