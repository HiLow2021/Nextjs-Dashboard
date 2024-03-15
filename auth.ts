import type { User } from '@/app/lib/definitions';
import prisma from '@/app/lib/prisma';
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import { authConfig } from './auth.config';

export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z.object({ email: z.string().email(), password: z.string().min(6) }).safeParse(credentials);
                if (parsedCredentials.success) {
                    const { email, password } = parsedCredentials.data;
                    const user = await getUser(email);
                    if (!user) {
                        return null;
                    }

                    const passwordsMatch = password === user.password;
                    if (passwordsMatch) {
                        return user;
                    }
                }

                console.log('Invalid credentials');
                return null;
            }
        })
    ]
});

async function getUser(email: string): Promise<User | undefined> {
    try {
        const user = await prisma.$queryRaw<User[]>`SELECT * FROM users WHERE email=${email}`;

        console.log(user);

        return user[0];
    } catch (error) {
        console.error('Failed to fetch user:', error);
        throw new Error('Failed to fetch user.');
    }
}
