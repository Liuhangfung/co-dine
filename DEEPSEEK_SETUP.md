# 🚀 DeepSeek API Configuration Guide

Your app now uses **DeepSeek API** for AI-powered recipe analysis and health improvements!

---

## 🔑 Your API Key

```
sk-35e0fe1cdfa544f785547e9669b2db35
```

---

## ⚙️ Configuration

### **For Docker Deployment:**

Edit your `.env` file:

```env
# DeepSeek API Configuration
BUILT_IN_FORGE_API_URL=https://api.deepseek.com
BUILT_IN_FORGE_API_KEY=sk-35e0fe1cdfa544f785547e9669b2db35

# Database (Required)
DATABASE_URL=your_database_url_here

# JWT Secret (Required)
JWT_SECRET=your_jwt_secret_here

# App Configuration
VITE_APP_ID=co-dine
NODE_ENV=production
PORT=3000
```

### **For Railway Deployment:**

Add these environment variables in Railway dashboard:

```
BUILT_IN_FORGE_API_URL = https://api.deepseek.com
BUILT_IN_FORGE_API_KEY = sk-35e0fe1cdfa544f785547e9669b2db35
```

---

## 🍎 New Health Improvement Features

The AI now follows these health principles:

### **1. 🍎 多用新鮮生果 (More Fresh Fruits)**
- Prioritize natural fruits for nutrition and flavor
- Use fruits to add natural sweetness

### **2. 🍯 糖分替代 (Sugar Substitution)**
- Replace white sugar with honey (蜜糖)
- Use natural fruit sweetness instead of refined sugar

### **3. 🟤 避免精製產品 (Avoid Refined Products)**
- Replace white sugar (白砂糖) with brown sugar (黃糖/紅糖)
- Use unrefined alternatives

### **4. 🍄 減鹽增鮮 (Reduce Salt, Enhance Flavor)**
- Replace some salt with homemade mushroom powder (自製香菇粉)
- Natural umami flavoring

### **5. 🌿 天然調味 (Natural Seasoning)**
- Use fruits instead of artificial sweet and sour sauces
- Natural flavor enhancers

---

## 🔄 Apply Changes

### **Docker:**

```bash
# Stop container
docker compose down

# Update .env file with DeepSeek settings
nano .env

# Restart
docker compose up -d

# Verify
docker compose logs --tail=50
```

### **Railway:**

```bash
# Push code changes
git push

# Railway will auto-deploy with new AI features!
```

---

## ✅ Verify It's Working

1. **Check API Configuration:**
   ```bash
   # Docker
   docker exec co-dine-app env | grep BUILT_IN_FORGE

   # Should show:
   # BUILT_IN_FORGE_API_URL=https://api.deepseek.com
   # BUILT_IN_FORGE_API_KEY=sk-...
   ```

2. **Test Health Improvements:**
   - Add a new recipe via web link or manual input
   - Check the "米芝蓮級 AI 改良建議" section
   - Look for health-focused suggestions:
     - Using fruits for sweetness
     - Honey instead of sugar
     - Mushroom powder for flavor
     - Natural ingredients

3. **View Logs:**
   ```bash
   # Docker
   docker compose logs -f

   # Look for successful AI API calls
   ```

---

## 💰 DeepSeek Pricing

DeepSeek is very cost-effective:

| Model | Input | Output |
|-------|-------|--------|
| deepseek-chat | $0.14/M tokens | $0.28/M tokens |

**Average recipe analysis:** ~$0.001-0.003 per recipe

Your API key already has credits loaded! 💰

---

## 🎯 Model Information

**Model:** `deepseek-chat`
- Fast and efficient
- Good for recipe analysis
- Cost-effective
- Great Chinese language support

---

## 🔧 Troubleshooting

### **API Key Not Working?**

1. Check API key is correct in `.env`:
   ```bash
   cat .env | grep BUILT_IN_FORGE_API_KEY
   ```

2. Verify API URL:
   ```bash
   cat .env | grep BUILT_IN_FORGE_API_URL
   ```

3. Restart container:
   ```bash
   docker compose restart
   ```

### **Health Guidelines Not Applied?**

The new health principles are automatically applied when:
- Adding recipes via web link
- Manual recipe input
- Processing user improvement suggestions

Test by creating a new recipe and checking the AI suggestions!

---

## 📊 Compare: Before vs After

### **Before (Generic):**
```
"可以用橄欖油代替普通油，更健康"
```

### **After (Health-Focused):**
```
"建議改良方案：
1. 🍯 糖分替代：將 50g 白砂糖改為 40g 蜜糖，減少精製糖攝入
2. 🍄 減鹽增鮮：將 10g 鹽減至 6g，加入 5g 自製香菇粉提鮮
3. 🍎 增加水果：加入 1 個蘋果切粒，增加天然甜味和纖維
4. 🌿 天然調味：用新鮮檸檬汁代替醋，提供天然酸味"
```

---

## 🎉 You're All Set!

Your app now uses:
- ✅ DeepSeek API for AI analysis
- ✅ Health-focused improvement suggestions
- ✅ Natural ingredient recommendations
- ✅ Cost-effective AI processing

**Start adding recipes and see the new health improvements in action!** 🍎✨

---

## 📞 Support

Need help? Check the logs:
```bash
docker compose logs --tail=100
```

Or test the health endpoint:
```bash
curl http://localhost:3000/api/health
```

**Happy cooking! 🍳**

