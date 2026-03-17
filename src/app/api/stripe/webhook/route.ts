
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Stripe with the secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Initialize Firebase Admin SDK
let serviceAccount: any = null;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  }
} catch (e) {
  console.error("Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON:", e);
}
let db: ReturnType<typeof getFirestore> | null = null;

if (serviceAccount && serviceAccount.project_id) {
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount),
      });
    }
    db = getFirestore();
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}


export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('Stripe-Signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error(`??  Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;

      const userId = session.client_reference_id;
      if (!userId) {
        console.error("Webhook Error: No client_reference_id (userId) in checkout session");
        return NextResponse.json({ error: "Client reference ID is missing" }, { status: 400 });
      }

      try {
        if (!db) {
          console.error("Firebase Admin is not initialized");
          return NextResponse.json({ error: "Database not configured" }, { status: 500 });
        }

        const userDocRef = db.collection('users').doc(userId);

        await userDocRef.update({
          subscriptionStatus: 'pro',
          stripeCustomerId: session.customer, // Save customer ID for future use
        });

        console.log(`?? User ${userId} upgraded to Pro plan.`);

      } catch (error) {
        console.error("Error updating user subscription in Firestore:", error);
        return NextResponse.json({ error: "Failed to update user subscription." }, { status: 500 });
      }

      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
