const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const dummyProducts = require('./products.json');

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// id valid hole ObjectId dey, na hole null
const toId = (id) => (ObjectId.isValid(id) ? new ObjectId(id) : null);

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db('techDB');
    const productsCollection = db.collection('products');
    const usersCollection = db.collection('users');
    const ordersCollection = db.collection('orders');

    // =====================================================
    // PRODUCTS APIs
    // =====================================================

    // sob product (?category=laptop&search=apple&sort=price_asc)
    app.get('/products', async (req, res) => {
      try {
        const { category, search, sort } = req.query;
        const query = {};
        if (category) query.category = category;
        if (search) query.name = { $regex: search, $options: 'i' };

        let sortOption = {};
        if (sort === 'price_asc') sortOption = { price: 1 };
        if (sort === 'price_desc') sortOption = { price: -1 };
        if (sort === 'rating') sortOption = { rating: -1 };

        const products = await productsCollection.find(query).sort(sortOption).toArray();
        res.send(products);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch products' });
      }
    });

    // ekta product
    app.get('/products/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid product id' });

        const product = await productsCollection.findOne({ _id });
        if (!product) return res.status(404).send({ message: 'Product not found' });
        res.send(product);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch product' });
      }
    });

    // notun product add
    app.post('/products', async (req, res) => {
      try {
        const result = await productsCollection.insertOne(req.body);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to add product' });
      }
    });

    // product update
    app.put('/products/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid product id' });

        const { _id: ignored, ...updatedData } = req.body;
        const result = await productsCollection.updateOne({ _id }, { $set: updatedData });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to update product' });
      }
    });

    // product delete
    app.delete('/products/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid product id' });

        const result = await productsCollection.deleteOne({ _id });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete product' });
      }
    });

    // dummy data seed (ekbar-i)
    app.post('/seed', async (req, res) => {
      try {
        const count = await productsCollection.countDocuments();
        if (count > 0) {
          return res.status(400).send({ message: 'Data already exists, seed skipped' });
        }
        const result = await productsCollection.insertMany(dummyProducts);
        res.send({ message: 'Dummy data inserted', insertedCount: result.insertedCount });
      } catch (error) {
        res.status(500).send({ message: 'Failed to seed data' });
      }
    });

    // =====================================================
    // USERS APIs
    // =====================================================

    // user save (login/register er por frontend theke call korben)
    app.post('/users', async (req, res) => {
      try {
        const { name, email, photo } = req.body;
        if (!email) return res.status(400).send({ message: 'Email is required' });

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) {
          return res.send({ message: 'User already exists', insertedId: null });
        }

        const newUser = { name, email, photo, role: 'user', createdAt: new Date() };
        const result = await usersCollection.insertOne(newUser);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to save user' });
      }
    });

    // sob user (admin dashboard er jonno)
    app.get('/users', async (req, res) => {
      try {
        const users = await usersCollection.find().toArray();
        res.send(users);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch users' });
      }
    });

    // email diye ekta user
    app.get('/users/:email', async (req, res) => {
      try {
        const user = await usersCollection.findOne({ email: req.params.email });
        if (!user) return res.status(404).send({ message: 'User not found' });
        res.send(user);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch user' });
      }
    });

    // user er role change (admin / user)
    app.patch('/users/:id/role', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid user id' });

        const { role } = req.body;
        if (!['user', 'admin'].includes(role)) {
          return res.status(400).send({ message: 'Role must be user or admin' });
        }
        const result = await usersCollection.updateOne({ _id }, { $set: { role } });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to update role' });
      }
    });

    // user delete
    app.delete('/users/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid user id' });

        const result = await usersCollection.deleteOne({ _id });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete user' });
      }
    });

    // =====================================================
    // ORDERS APIs
    // =====================================================

    // notun order
    // body: { customerEmail, shippingAddress, items: [{ productId, quantity }] }
    app.post('/orders', async (req, res) => {
      try {
        const { customerEmail, shippingAddress, items } = req.body;
        if (!customerEmail || !Array.isArray(items) || items.length === 0) {
          return res.status(400).send({ message: 'customerEmail and items are required' });
        }

        const ids = items.map((item) => toId(item.productId));
        if (ids.includes(null)) {
          return res.status(400).send({ message: 'Invalid productId in items' });
        }

        const products = await productsCollection.find({ _id: { $in: ids } }).toArray();

        const orderItems = [];
        let totalPrice = 0;

        for (const item of items) {
          const product = products.find((p) => p._id.toString() === item.productId);
          const quantity = Number(item.quantity) || 1;

          if (!product) {
            return res.status(404).send({ message: `Product not found: ${item.productId}` });
          }
          if (product.stock < quantity) {
            return res.status(400).send({ message: `Not enough stock for ${product.name}` });
          }

          orderItems.push({
            productId: product._id,
            name: product.name,
            price: product.price,
            quantity,
          });
          totalPrice += product.price * quantity;
        }

        const order = {
          customerEmail,
          shippingAddress,
          items: orderItems,
          totalPrice,
          status: 'pending',
          createdAt: new Date(),
        };
        const result = await ordersCollection.insertOne(order);

        // stock komano
        await productsCollection.bulkWrite(
          orderItems.map((item) => ({
            updateOne: {
              filter: { _id: item.productId },
              update: { $inc: { stock: -item.quantity } },
            },
          }))
        );

        res.status(201).send({ message: 'Order placed', orderId: result.insertedId, totalPrice });
      } catch (error) {
        res.status(500).send({ message: 'Failed to place order' });
      }
    });

    // sob order (?email=user@gmail.com dile shudhu oi user er)
    app.get('/orders', async (req, res) => {
      try {
        const query = {};
        if (req.query.email) query.customerEmail = req.query.email;

        const orders = await ordersCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(orders);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch orders' });
      }
    });

    // ekta order
    app.get('/orders/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid order id' });

        const order = await ordersCollection.findOne({ _id });
        if (!order) return res.status(404).send({ message: 'Order not found' });
        res.send(order);
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch order' });
      }
    });

    // order status change
    app.patch('/orders/:id/status', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid order id' });

        const { status } = req.body;
        if (!ORDER_STATUSES.includes(status)) {
          return res.status(400).send({ message: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });
        }
        const result = await ordersCollection.updateOne({ _id }, { $set: { status } });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to update status' });
      }
    });

    // order delete
    app.delete('/orders/:id', async (req, res) => {
      try {
        const _id = toId(req.params.id);
        if (!_id) return res.status(400).send({ message: 'Invalid order id' });

        const result = await ordersCollection.deleteOne({ _id });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: 'Failed to delete order' });
      }
    });

    // =====================================================
    // STATS API (admin dashboard)
    // =====================================================
    app.get('/stats', async (req, res) => {
      try {
        const [totalProducts, totalUsers, totalOrders, revenueResult] = await Promise.all([
          productsCollection.countDocuments(),
          usersCollection.countDocuments(),
          ordersCollection.countDocuments(),
          ordersCollection
            .aggregate([
              { $match: { status: { $ne: 'cancelled' } } },
              { $group: { _id: null, revenue: { $sum: '$totalPrice' } } },
            ])
            .toArray(),
        ]);

        res.send({
          totalProducts,
          totalUsers,
          totalOrders,
          revenue: revenueResult[0]?.revenue || 0,
        });
      } catch (error) {
        res.status(500).send({ message: 'Failed to fetch stats' });
      }
    });

  } catch (error) {
    console.error("MongoDB connection error:", error);
  }
}
run();

// Basic test route
app.get('/', (req, res) => {
  res.send('Server is running');
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});