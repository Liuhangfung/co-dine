import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChefHat, Link as LinkIcon, PenTool, Sparkles, Utensils, BarChart3 } from "lucide-react";
import { Link } from "wouter";

export default function Home() {

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="h-8 w-8 text-green-600" />
            <h1 className="text-2xl font-bold text-green-900">Co-Dine 健康飲食食譜管理及分析系統</h1>
          </div>
          <div>
            <Link href="/dashboard">
              <Button>進入系統</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full mb-6">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">米芝蓮級AI智能分析</span>
          </div>
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            首創AI智慧中外健康食譜
          </h2>
          <p className="text-2xl font-semibold text-green-600 mb-6">
            AI智慧廚房飲食新革命
          </p>
          <p className="text-xl text-gray-700 mb-8 max-w-2xl mx-auto font-medium">
            健康均衡飲食的重要性
          </p>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            使用 AI 智能分析傳統食譜，提供健康食材替換建議，在保留原有風味的前提下，
            嚴格精準計算每樣食材的份量、卡路里和營養成分，清晰對比改造前後的健康數據。
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8">
                開始使用
              </Button>
            </Link>
            <Link href="/browse">
              <Button size="lg" variant="outline" className="text-lg px-8">
                瀏覽食譜
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">兩種輸入方式</h3>
          <p className="text-gray-600">靈活多樣，每種都支援 AI 健康改造分析</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="border-2 hover:border-green-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <LinkIcon className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>網址連結</CardTitle>
              <CardDescription>
                貼上傳統食譜網址，AI 自動分析並提供健康改造建議
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 自動提取食材和步驟</li>
                <li>• 精準計算營養成分</li>
                <li>• AI 推薦健康替代方案</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2 hover:border-green-200 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <PenTool className="h-6 w-6 text-green-600" />
              </div>
              <CardTitle>手動輸入</CardTitle>
              <CardDescription>
                手動輸入食譜，精確控制每樣食材份量
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• 自由編輯食材和份量</li>
                <li>• 即時計算營養數據</li>
                <li>• 靈活分類管理</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="bg-green-50 py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">AI 智能分析</h3>
            <p className="text-gray-600">精準計算、清晰對比、保留風味</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Utensils className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>營養成分精準計算</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  嚴格精準計算每樣食材的份量、卡路里和營養成分，確保數據準確可靠。
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>✓ 精準份量控制</div>
                    <div>✓ 卡路里計算</div>
                    <div>✓ 宏量營養素</div>
                    <div>✓ 微量營養素</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-green-600" />
                </div>
                <CardTitle>健康改造對比</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 mb-4">
                  AI 提供健康食材替換建議，在保留原有風味的前提下，清晰對比改造前後的營養數據。
                </p>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>✓ 食材智能替換</div>
                    <div>✓ 營養前後對比</div>
                    <div>✓ 保留原有風味</div>
                    <div>✓ 健康益處說明</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Classification Section */}
      <section className="container py-20">
        <div className="text-center mb-12">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">多維度分類系統</h3>
          <p className="text-gray-600">中外菜式，精準管理</p>
        </div>
        <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold mb-2">主要食材</h4>
            <p className="text-sm text-gray-600">雞肉、牛肉、海鮮、蔬菜等</p>
          </div>
          <div className="text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold mb-2">菜系分類</h4>
            <p className="text-sm text-gray-600">中菜、西菜、日菜、韓菜等</p>
          </div>
          <div className="text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold mb-2">烹調方法</h4>
            <p className="text-sm text-gray-600">蒸、炒、煮、烤等</p>
          </div>
          <div className="text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
            <h4 className="font-semibold mb-2">健康標籤</h4>
            <p className="text-sm text-gray-600">低卡、高蛋白、素食等</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-green-600 text-white py-20">
        <div className="container text-center">
          <h3 className="text-4xl font-bold mb-4">準備好開始了嗎？</h3>
          <p className="text-xl mb-8 text-green-100">
            立即體驗 AI 智能食譜管理及分析系統
          </p>
          <Link href="/dashboard">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              進入系統
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container text-center text-gray-600">
          <p>© 2025 Co-Dine 健康飲食食譜管理及分析系統. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
