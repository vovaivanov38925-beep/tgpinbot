// Browser notifications manager
export class NotificationManager {
  private static instance: NotificationManager
  private permission: NotificationPermission = 'default'

  static getInstance(): NotificationManager {
    if (!NotificationManager.instance) {
      NotificationManager.instance = new NotificationManager()
    }
    return NotificationManager.instance
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted'
      return true
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission()
      this.permission = permission
      return permission === 'granted'
    }

    return false
  }

  async sendNotification(title: string, options?: NotificationOptions): Promise<Notification | null> {
    if (this.permission !== 'granted') {
      const granted = await this.requestPermission()
      if (!granted) return null
    }

    try {
      const notification = new Notification(title, {
        icon: '/logo.svg',
        badge: '/logo.svg',
        ...options
      })

      notification.onclick = () => {
        window.focus()
        notification.close()
      }

      return notification
    } catch (error) {
      console.error('Failed to send notification:', error)
      return null
    }
  }

  async sendTaskReminder(task: { title: string; description?: string | null; category?: string | null }): Promise<Notification | null> {
    let body = task.description || 'Напоминание о задаче'
    if (task.category) {
      body = `📁 ${task.category}\n${body}`
    }

    return this.sendNotification(`⏰ ${task.title}`, {
      body,
      tag: 'task-reminder',
      requireInteraction: true
    })
  }
}

export const notificationManager = NotificationManager.getInstance()
