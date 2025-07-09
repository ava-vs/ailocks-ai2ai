/**
 * Group Service - управление группами Айлоков
 * Обеспечивает функционал создания групп, управления членами,
 * и интеграцию с системой интентов
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Типы для моделей данных групп
export interface Group {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: Date;
  updated_at: Date;
  type: 'family' | 'team' | 'friends';
  status: string;
  settings: Record<string, any>;
  [key: string]: unknown;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  ailock_id: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  invite_status: 'pending' | 'accepted' | 'declined';
  joined_at: Date;
  invited_by?: string;
  [key: string]: unknown;
}

export interface GroupIntent {
  id: string;
  group_id: string;
  intent_id: string;
  added_by: string;
  added_at: Date;
  permissions: Record<string, any>;
  [key: string]: unknown;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'guest';
  token: string;
  created_at: Date;
  expires_at?: Date;
  status: 'pending' | 'accepted' | 'declined';
  [key: string]: unknown;
}

export class GroupService {
  /**
   * Создание новой группы
   */
  async createGroup(
    name: string,
    type: 'family' | 'team' | 'friends',
    description: string | null,
    created_by: string,
    ailock_id: string,
    settings: Record<string, any> = {}
  ): Promise<Group> {
    const groupId = uuidv4();

    // Создаём транзакцию для атомарного создания группы и добавления создателя как owner
    const result = await db.transaction(async (tx) => {
      // 1. Создаём группу
      await tx.execute(sql`
        INSERT INTO "groups" (id, name, description, created_by, type, settings)
        VALUES (${groupId}, ${name}, ${description}, ${created_by}, ${type}, ${JSON.stringify(settings)})
      `);

      // 2. Добавляем создателя как owner
      await tx.execute(sql`
        INSERT INTO group_members (group_id, user_id, ailock_id, role, invite_status, invited_by)
        VALUES (${groupId}, ${created_by}, ${ailock_id}, 'owner', 'accepted', ${created_by})
      `);

      // 3. Получаем созданную группу
      const group = await tx.execute<Group>(sql`
        SELECT * FROM "groups" WHERE id = ${groupId}
      `);

      return group.rows[0];
    });

    return result;
  }

  /**
   * Получение группы по ID
   */
  async getGroup(groupId: string): Promise<Group | null> {
    const result = await db.execute<Group>(sql`
      SELECT * FROM "groups" WHERE id = ${groupId}
    `);
    
    return result.rows[0] || null;
  }

  /**
   * Список групп пользователя
   */
  async getUserGroups(userId: string, type?: string): Promise<Group[]> {
    let query = sql`
      SELECT g.* 
      FROM "groups" g
      JOIN "group_members" gm ON g.id = gm.group_id
      WHERE gm.user_id = ${userId} AND gm.invite_status = 'accepted'
    `;

    if (type) {
      query = sql`${query} AND g.type = ${type}`;
    }

    query = sql`${query} ORDER BY g.updated_at DESC`;
    
    const result = await db.execute<Group>(query);
    return result.rows;
  }

  /**
   * Обновление информации о группе
   */
  async updateGroup(
    groupId: string, 
    userId: string, 
    data: Partial<Omit<Group, 'id' | 'created_at' | 'created_by'>>
  ): Promise<Group | null> {
    // Проверяем права доступа (owner или admin)
    const hasPermission = await this.checkMemberPermission(groupId, userId, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    const setFields: string[] = [];
    const values: any[] = [];
    
    // Динамически строим SET часть запроса
    Object.entries(data).forEach(([key, value], index) => {
      if (value !== undefined && !['id', 'created_at', 'created_by'].includes(key)) {
        setFields.push(`"${key}" = $${index + 1}`);
        values.push(value);
      }
    });
    
    if (setFields.length === 0) {
      return this.getGroup(groupId);
    }
    
    values.push(groupId); // Для WHERE условия
    
    // Формируем динамический SQL запрос с параметрами
    const setClause = setFields.map((field, i) => `${field}`).join(', ');
    const query = sql`
      UPDATE "groups" SET ${sql.raw(setClause)} 
      WHERE id = ${groupId} 
      RETURNING *
    `;
    
    const result = await db.execute<Group>(query);

    return result.rows[0] || null;
  }

  /**
   * Добавление участника в группу
   */
  async addMember(
    groupId: string,
    userId: string,
    ailockId: string,
    role: 'admin' | 'member' | 'guest',
    invitedBy: string,
    inviteStatus: 'pending' | 'accepted' = 'pending'
  ): Promise<GroupMember> {
    // Проверяем права приглашающего (owner или admin)
    const hasPermission = await this.checkMemberPermission(groupId, invitedBy, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    const result = await db.execute<GroupMember>(sql`
      INSERT INTO "group_members" (group_id, user_id, ailock_id, role, invite_status, invited_by)
      VALUES (${groupId}, ${userId}, ${ailockId}, ${role}, ${inviteStatus}, ${invitedBy})
      RETURNING *
    `);

    return result.rows[0];
  }

  /**
   * Получение участника группы
   */
  async getGroupMember(groupId: string, userId: string): Promise<GroupMember | null> {
    const result = await db.execute<GroupMember>(sql`
      SELECT * FROM "group_members"
      WHERE group_id = ${groupId} AND user_id = ${userId}
    `);

    return result.rows[0] || null;
  }

  /**
   * Список участников группы
   */
  async getGroupMembers(groupId: string): Promise<GroupMember[]> {
    const result = await db.execute<GroupMember>(sql`
      SELECT gm.*, u.name as user_name, a.name as ailock_name
      FROM "group_members" gm
      JOIN "users" u ON gm.user_id = u.id
      JOIN "ailocks" a ON gm.ailock_id = a.id
      WHERE gm.group_id = ${groupId}
      ORDER BY 
        CASE 
          WHEN gm.role = 'owner' THEN 1
          WHEN gm.role = 'admin' THEN 2
          WHEN gm.role = 'member' THEN 3
          ELSE 4
        END, 
        gm.joined_at ASC
    `);

    return result.rows;
  }

  /**
   * Обновление роли участника
   */
  async updateMemberRole(
    groupId: string,
    targetUserId: string,
    role: 'admin' | 'member' | 'guest',
    updatedBy: string
  ): Promise<GroupMember | null> {
    // Проверяем права обновляющего (owner или admin)
    const hasPermission = await this.checkMemberPermission(groupId, updatedBy, ['owner']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    // Не позволяем менять роль owner
    const targetMember = await this.getGroupMember(groupId, targetUserId);
    if (!targetMember) {
      throw new Error('Member not found');
    }
    
    if (targetMember.role === 'owner') {
      throw new Error('Cannot change owner role');
    }

    const result = await db.execute<GroupMember>(sql`
      UPDATE "group_members"
      SET role = ${role}
      WHERE group_id = ${groupId} AND user_id = ${targetUserId}
      RETURNING *
    `);

    return result.rows[0] || null;
  }

  /**
   * Удаление участника из группы
   */
  async removeMember(groupId: string, targetUserId: string, removedBy: string): Promise<boolean> {
    // Проверяем права удаляющего (owner или admin)
    const hasPermission = await this.checkMemberPermission(groupId, removedBy, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    // Не позволяем удалять owner
    const targetMember = await this.getGroupMember(groupId, targetUserId);
    if (!targetMember) {
      return true; // Участник уже удален или не существует
    }
    
    if (targetMember.role === 'owner') {
      throw new Error('Cannot remove owner');
    }

    // Admin может удалять только member и guest
    if (
      targetMember.role === 'admin' && 
      !(await this.checkMemberPermission(groupId, removedBy, ['owner']))
    ) {
      throw new Error('Permission denied: Only owner can remove admin');
    }

    await db.execute(sql`
      DELETE FROM "group_members"
      WHERE group_id = ${groupId} AND user_id = ${targetUserId}
    `);

    return true;
  }

  /**
   * Добавление интента в группу
   */
  async addIntent(
    groupId: string, 
    intentId: string, 
    addedBy: string,
    permissions: Record<string, any> = {}
  ): Promise<GroupIntent> {
    // Проверяем права добавляющего
    const hasPermission = await this.checkMemberPermission(groupId, addedBy, ['owner', 'admin', 'member']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    const result = await db.execute<GroupIntent>(sql`
      INSERT INTO "group_intents" (group_id, intent_id, added_by, permissions)
      VALUES (${groupId}, ${intentId}, ${addedBy}, ${JSON.stringify(permissions)})
      RETURNING *
    `);

    return result.rows[0];
  }

  /**
   * Получение интентов группы
   */
  async getGroupIntents(groupId: string): Promise<GroupIntent[]> {
    const result = await db.execute<GroupIntent>(sql`
      SELECT gi.*, i.title, i.description, i.status
      FROM "group_intents" gi
      JOIN "intents" i ON gi.intent_id = i.id
      WHERE gi.group_id = ${groupId}
      ORDER BY gi.added_at DESC
    `);

    return result.rows;
  }

  /**
   * Создание приглашения по email
   */
  async createInvite(
    groupId: string,
    email: string,
    role: 'admin' | 'member' | 'guest',
    invitedBy: string,
    expiresIn: number = 7 * 24 * 60 * 60 * 1000 // 7 дней в миллисекундах
  ): Promise<GroupInvite> {
    // Проверяем права приглашающего
    const hasPermission = await this.checkMemberPermission(groupId, invitedBy, ['owner', 'admin']);
    if (!hasPermission) {
      throw new Error('Permission denied');
    }

    const token = uuidv4();
    const expires = new Date(Date.now() + expiresIn);

    const result = await db.execute<GroupInvite>(sql`
      INSERT INTO "group_invites" (group_id, email, role, token, expires_at)
      VALUES (${groupId}, ${email}, ${role}, ${token}, ${expires})
      ON CONFLICT (group_id, email) 
      DO UPDATE SET role = ${role}, token = ${token}, expires_at = ${expires}, status = 'pending'
      RETURNING *
    `);

    return result.rows[0];
  }

  /**
   * Принятие приглашения по токену
   */
  async acceptInvite(token: string, userId: string, ailockId: string): Promise<Group | null> {
    // Транзакция для атомарного обновления приглашения и добавления участника
    const result = await db.transaction(async (tx) => {
      // 1. Получаем и проверяем приглашение
      const inviteResult = await tx.execute<GroupInvite>(sql`
        SELECT * FROM "group_invites"
        WHERE token = ${token} AND status = 'pending' AND (expires_at IS NULL OR expires_at > NOW())
      `);
      
      if (inviteResult.rows.length === 0) {
        throw new Error('Invalid or expired invitation token');
      }
      
      const invite = inviteResult.rows[0];
      
      // 2. Обновляем статус приглашения
      await tx.execute(sql`
        UPDATE "group_invites"
        SET status = 'accepted'
        WHERE token = ${token}
      `);
      
      // 3. Добавляем пользователя в группу
      await tx.execute(sql`
        INSERT INTO "group_members" (group_id, user_id, ailock_id, role, invite_status)
        VALUES (${invite.group_id}, ${userId}, ${ailockId}, ${invite.role}, 'accepted')
        ON CONFLICT (group_id, ailock_id) 
        DO UPDATE SET role = ${invite.role}, invite_status = 'accepted'
      `);
      
      // 4. Получаем информацию о группе
      const groupResult = await tx.execute<Group>(sql`
        SELECT * FROM "groups" WHERE id = ${invite.group_id}
      `);
      
      return groupResult.rows[0] || null;
    });
    
    return result;
  }

  /**
   * Проверка права пользователя на определенную операцию
   */
  async checkMemberPermission(
    groupId: string, 
    userId: string, 
    allowedRoles: ('owner' | 'admin' | 'member' | 'guest')[]
  ): Promise<boolean> {
    const result = await db.execute<{ role: string }>(sql`
      SELECT role FROM "group_members"
      WHERE group_id = ${groupId} AND user_id = ${userId} AND invite_status = 'accepted'
    `);
    
    if (result.rows.length === 0) {
      return false;
    }
    
    return allowedRoles.includes(result.rows[0].role as any);
  }

  /**
   * Передача прав владельца другому участнику
   */
  async transferOwnership(
    groupId: string, 
    currentOwnerId: string, 
    newOwnerId: string
  ): Promise<boolean> {
    // Проверяем, что текущий пользователь - owner
    const isOwner = await this.checkMemberPermission(groupId, currentOwnerId, ['owner']);
    if (!isOwner) {
      throw new Error('Permission denied');
    }
    
    // Проверяем, что новый owner существует и является членом группы
    const newOwnerMember = await this.getGroupMember(groupId, newOwnerId);
    if (!newOwnerMember) {
      throw new Error('New owner must be a member of the group');
    }

    // Транзакция для атомарного изменения ролей
    await db.transaction(async (tx) => {
      // 1. Понижаем текущего owner до admin
      await tx.execute(sql`
        UPDATE "group_members"
        SET role = 'admin'
        WHERE group_id = ${groupId} AND user_id = ${currentOwnerId}
      `);
      
      // 2. Повышаем нового участника до owner
      await tx.execute(sql`
        UPDATE "group_members"
        SET role = 'owner'
        WHERE group_id = ${groupId} AND user_id = ${newOwnerId}
      `);
    });

    return true;
  }

  /**
   * Получение списка приглашений для группы
   */
  async getPendingInvites(groupId: string): Promise<GroupInvite[]> {
    const result = await db.execute<GroupInvite>(sql`
      SELECT * FROM "group_invites"
      WHERE group_id = ${groupId} AND status = 'pending'
      ORDER BY created_at DESC
    `);
    
    return result.rows;
  }

  /**
   * Отмена приглашения
   */
  async cancelInvite(inviteId: string): Promise<boolean> {
    await db.execute(sql`
      UPDATE "group_invites"
      SET status = 'declined'
      WHERE id = ${inviteId}
    `);
    
    return true;
  }

  /**
   * Удаление интента из группы
   */
  async removeIntent(groupId: string, intentId: string): Promise<boolean> {
    await db.execute(sql`
      DELETE FROM "group_intents"
      WHERE group_id = ${groupId} AND intent_id = ${intentId}
    `);
    
    return true;
  }

  /**
   * Удаление группы
   */
  async deleteGroup(groupId: string, userId: string): Promise<boolean> {
    // Только owner может удалить группу
    const isOwner = await this.checkMemberPermission(groupId, userId, ['owner']);
    if (!isOwner) {
      throw new Error('Permission denied');
    }

    // Удаление выполняется в транзакции для сохранения целостности данных
    await db.transaction(async (tx) => {
      // 1. Удаляем все связанные интенты группы
      await tx.execute(sql`
        DELETE FROM "group_intents" WHERE group_id = ${groupId}
      `);
      
      // 2. Удаляем всех участников
      await tx.execute(sql`
        DELETE FROM "group_members" WHERE group_id = ${groupId}
      `);
      
      // 3. Удаляем все приглашения
      await tx.execute(sql`
        DELETE FROM "group_invites" WHERE group_id = ${groupId}
      `);
      
      // 4. Удаляем саму группу
      await tx.execute(sql`
        DELETE FROM "groups" WHERE id = ${groupId}
      `);
    });

    return true;
  }

  /**
   * Поиск пользователей для приглашения
   */
  async searchUsers(query: string, limit: number = 10): Promise<any[]> {
    // Проверяем, что запрос не пустой
    if (!query || query.trim().length < 2) {
      return [];
    }

    // Поиск по email или имени
    try {
      const result = await db.execute(sql`
        SELECT u.id, u.email, p.display_name, p.avatar_url
        FROM "users" u
        LEFT JOIN "profiles" p ON u.id = p.user_id
        WHERE 
          u.email ILIKE ${'%' + query + '%'} OR
          p.display_name ILIKE ${'%' + query + '%'}
        LIMIT ${limit}
      `);
      
      return result.rows;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }
}

/**
 * Функция создания общего сообщения в группе
 */
export async function createGroupMessage(
  groupId: string, 
  userId: string,
  ailockId: string,
  message: string
): Promise<any> {
  const groupService = new GroupService();
  
  // Проверяем права на отправку сообщений в группу
  const canChat = await groupService.checkMemberPermission(groupId, userId, ['owner', 'admin', 'member', 'guest']);
  if (!canChat) {
    throw new Error('Permission denied');
  }
  
  // Получаем список всех участников группы
  const members = await groupService.getGroupMembers(groupId);
  
  // Вставляем сообщение в базу и связываем с группой
  const result = await db.execute(sql`
    INSERT INTO "group_messages" (group_id, sender_id, sender_ailock_id, message, created_at)
    VALUES (${groupId}, ${userId}, ${ailockId}, ${message}, NOW())
    RETURNING id, group_id, sender_id, message, created_at
  `);
  
  return result.rows[0];
}
