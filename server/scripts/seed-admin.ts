import bcrypt from 'bcrypt';
import { db } from '../db';
import { login } from '../../shared/schema';

async function seedAdmin() {
  try {
    // Hash da senha
    const hashedPassword = await bcrypt.hash('Gustavoprata1@', 10);
    
    // Inserir o usuário admin
    const result = await db.insert(login).values({
      user: 'gustavoprtt',
      password: hashedPassword,
    }).onConflictDoNothing();
    
    console.log('Admin user created successfully');
  } catch (error) {
    console.error('Error creating admin user:', error);
  }
}

seedAdmin();