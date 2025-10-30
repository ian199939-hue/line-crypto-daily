import 'dotenv/config'
import express from 'express'
import { middleware, Client } from '@line/bot-sdk'
import OpenAI from 'openai'
import dayjs from 'dayjs'

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
}
const app = express()
const line = new Client(config)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// 健康檢查
app.get('/', (_, res) => res.send('OK'))

// Webhook
app.post('/webhook', middleware(config), async (req, res) => {
  const events = req.body.events || []
  await Promise.all(events.map(handleEvent))
  res.sendStatus(200)
})

async function handleEvent(event) {
  try {
    if (event.type === 'follow') {
      return line.replyMessage(event.replyToken, {
        type: 'text',
        text: '歡迎加入｜幣圈日報\n輸入「日報」可取得今日日報；輸入任一幣名（如：BTC）獲得精簡解讀。'
      })
    }

    if (event.type === 'message' && event.message.type === 'text') {
      const q = (event.message.text || '').trim()

      if (q === '日報') {
        const text = await genDailyBrief()
        return line.replyMessage(event.replyToken, { type: 'text', text })
      }

      const text = await aiReply(q)
      return line.replyMessage(event.replyToken, { type: 'text', text })
    }
  } catch (e) {
    console.error('handleEvent error:', e)
  }
}

async function genDailyBrief() {
  const today = dayjs().format('YYYY-MM-DD')
  const r = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: '你是專業加密市場日報撰稿人，使用繁體中文，重點清晰，避免空話。' },
      { role: 'user', content:
`請產生「${today} 幣圈日報」：
- 市場總覽（BTC/ETH/主流幣方向）
- 衍生品線索（資金費率/未平倉/量能）
- 48小時內重要事件
- 2條可執行的交易觀察
若缺資料以「—」省略，不可捏造；控制在 280~480 字，段落清楚，結尾附一句簡短免責。` }
    ],
  })
  return r.choices[0].message.content.trim()
}

async function aiReply(text) {
  const r = await openai.chat.completions.create({
    model: 'gpt-5',
    messages: [
      { role: 'system', content: '你是幣圈研究員，回覆精簡、具體、繁體中文，不講空話。' },
      { role: 'user', content: text }
    ],
  })
  return r.choices[0].message.content.trim()
}

app.listen(process.env.PORT || 3000, () => {
  console.log('Server started')
})

