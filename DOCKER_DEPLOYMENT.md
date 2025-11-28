# 🐳 Docker Deployment Guide - Co-Dine

Complete guide to deploy Co-Dine on your local server using Docker.

---

## 📋 Prerequisites

- ✅ Docker installed (version 20.10+)
- ✅ Docker Compose installed (version 2.0+)
- ✅ At least 2GB RAM available
- ✅ 5GB disk space

### Check Docker Installation:

```bash
docker --version
docker-compose --version
```

---

## 🚀 Quick Start (5 Minutes)

### **Step 1: Create Environment File**

Create a `.env` file in the project root:

```bash
# Copy example environment file
cp .env.example .env
```

Or create manually:

```env
# Database (Supabase or local PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-change-this

# App Configuration
VITE_APP_ID=co-dine
NODE_ENV=production
PORT=3000

# Built-in Forge API (optional)
BUILT_IN_FORGE_API_URL=https://api.built-in-forge.com
BUILT_IN_FORGE_API_KEY=your-api-key-here
```

### **Step 2: Build and Start**

```bash
# Build the Docker image
docker-compose build

# Start the application
docker-compose up -d
```

### **Step 3: Access Your App**

Open browser: **http://localhost:3000**

---

## 🎯 Docker Commands

### **Start the application:**
```bash
docker-compose up -d
```

### **Stop the application:**
```bash
docker-compose down
```

### **View logs:**
```bash
# All logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100 -f
```

### **Restart the application:**
```bash
docker-compose restart
```

### **Rebuild after code changes:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Check status:**
```bash
docker-compose ps
```

---

## 🔧 Advanced Configuration

### **Custom Port**

Edit `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Access on port 8080
```

### **Memory Limits**

Add resource limits in `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### **Network Mode**

For host network access (Linux only):

```yaml
services:
  app:
    network_mode: "host"
```

---

## 🗄️ Database Setup

### **Option 1: Use Existing Supabase** (Recommended)

Just set `DATABASE_URL` in `.env`:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.xxx.supabase.co:6543/postgres?pgbouncer=true
```

### **Option 2: Add PostgreSQL to Docker**

Edit `docker-compose.yml`:

```yaml
services:
  db:
    image: postgres:15-alpine
    container_name: co-dine-db
    environment:
      - POSTGRES_USER=codine
      - POSTGRES_PASSWORD=changeme
      - POSTGRES_DB=codine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - co-dine-network
    restart: unless-stopped

  app:
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql://codine:changeme@db:5432/codine

volumes:
  postgres_data:
```

Then start:

```bash
docker-compose up -d
```

---

## 📊 Monitoring & Maintenance

### **Health Check**

The app includes automatic health checks:

```bash
# Check health status
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-11-28T..."}
```

### **Resource Usage**

```bash
# Check CPU/Memory usage
docker stats co-dine-app
```

### **Disk Space**

```bash
# Check image sizes
docker images

# Clean up unused images/containers
docker system prune -a
```

---

## 🔄 Updates & Backups

### **Update to Latest Code**

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### **Backup Data**

If using local PostgreSQL:

```bash
# Backup database
docker exec co-dine-db pg_dump -U codine codine > backup.sql

# Restore database
cat backup.sql | docker exec -i co-dine-db psql -U codine codine
```

---

## 🐛 Troubleshooting

### **Problem: Port already in use**

```bash
# Find what's using port 3000
netstat -ano | findstr :3000   # Windows
lsof -i :3000                  # Mac/Linux

# Change port in docker-compose.yml
ports:
  - "3001:3000"
```

### **Problem: Container keeps restarting**

```bash
# Check logs
docker-compose logs app

# Common issues:
# - DATABASE_URL not set
# - Database not accessible
# - Missing environment variables
```

### **Problem: Playwright/YouTube scraping fails**

```bash
# Verify Playwright is installed
docker exec co-dine-app npx playwright --version

# Rebuild with fresh Playwright install
docker-compose build --no-cache
```

### **Problem: Out of memory**

Edit `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
```

### **Problem: Can't connect to database**

```bash
# Test database connection
docker exec co-dine-app node -e "console.log(process.env.DATABASE_URL)"

# Verify database is reachable
docker exec co-dine-app wget --spider postgresql://...
```

---

## 🌐 Production Deployment

### **Nginx Reverse Proxy** (Recommended)

Create `nginx.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Install Nginx:
```bash
# Ubuntu/Debian
sudo apt install nginx
sudo cp nginx.conf /etc/nginx/sites-available/codine
sudo ln -s /etc/nginx/sites-available/codine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### **SSL Certificate** (HTTPS)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

### **Firewall Setup**

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

---

## 🔐 Security Best Practices

1. **Change default secrets:**
   ```env
   JWT_SECRET=$(openssl rand -hex 32)
   ```

2. **Use strong database passwords**

3. **Enable firewall:**
   ```bash
   sudo ufw enable
   sudo ufw allow 22    # SSH
   sudo ufw allow 80    # HTTP
   sudo ufw allow 443   # HTTPS
   ```

4. **Regular updates:**
   ```bash
   docker-compose pull
   docker-compose up -d
   ```

5. **Monitor logs:**
   ```bash
   docker-compose logs -f | grep -i error
   ```

---

## 📈 Performance Optimization

### **Multi-Core Support**

In `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      mode: replicated
      replicas: 2
```

### **Caching**

Add Redis for caching (optional):

```yaml
services:
  redis:
    image: redis:alpine
    container_name: co-dine-redis
    ports:
      - "6379:6379"
    networks:
      - co-dine-network
```

---

## 🆘 Support

### **Check Service Status**

```bash
docker-compose ps
docker-compose logs --tail=50
curl http://localhost:3000/api/health
```

### **Full System Check**

```bash
# Check Docker
docker info

# Check disk space
df -h

# Check memory
free -h

# Check containers
docker ps -a
```

---

## 🎯 Quick Reference

| Command | Description |
|---------|-------------|
| `docker-compose up -d` | Start in background |
| `docker-compose down` | Stop and remove |
| `docker-compose logs -f` | View live logs |
| `docker-compose restart` | Restart services |
| `docker-compose ps` | Check status |
| `docker-compose build` | Rebuild images |
| `docker exec -it co-dine-app sh` | Access container shell |

---

## ✅ Success Checklist

- [ ] Docker and Docker Compose installed
- [ ] `.env` file created with all required variables
- [ ] `docker-compose build` completed successfully
- [ ] `docker-compose up -d` running without errors
- [ ] Health check returns OK: `curl localhost:3000/api/health`
- [ ] App accessible in browser: `http://localhost:3000`
- [ ] YouTube scraping works (test with a recipe URL)
- [ ] Database connection working
- [ ] Logs show no errors: `docker-compose logs`

---

## 🎉 You're All Set!

Your Co-Dine app is now running in Docker on your local server!

**Access your app:** http://localhost:3000

**Need help?** Check the logs: `docker-compose logs -f`

---

**Happy Cooking! 🍳**

