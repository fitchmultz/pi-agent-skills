# When to Mock

Mock at **system boundaries** only:

- External APIs (payment, email, etc.)
- Databases (sometimes - prefer test DB)
- Time/randomness
- File system (sometimes)

Don't mock:

- Your own classes/modules
- Internal collaborators
- Anything you control
- Production code paths just because they are inconvenient to test

## Using existing boundaries

Prefer the repository's existing test transport, fixture, or dependency boundary. Do not change the public API or introduce a wrapper only for a test.

**1. Reuse dependency injection where the production design needs it**

An existing explicit dependency can make an external operation replaceable:

```typescript
// Easy to mock
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to mock
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Model the actual external contract**

When production already uses operation-specific interfaces, keep each fake's request and response faithful to that operation. Do not replace a generic transport solely to avoid conditional test setup:

```typescript
// GOOD: Each function is independently mockable
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// Also valid when this is the production transport boundary
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

A fake may return controlled responses, but must not implement the behavior being tested. If transport behavior is the contract, exercise it through a fake server or real test transport rather than mocking it away.