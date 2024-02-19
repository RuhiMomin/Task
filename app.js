let express = require('express')
let app = express()
let { Sequelize, Model, DataTypes, Op, QueryTypes } = require("sequelize")
let port = 3002
let sequelizeCon = new Sequelize("Mysql://root:@localhost/interview")
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

sequelizeCon.authenticate().then(() => {
    console.log("Db Connected");
}).catch((error) => {
    console.log(`Error ${error}`);
})
// sequelizeCon.sync({ alter: true })

//category schema
class Category extends Model { }
Category.init({
    catID: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    catName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    catDesc: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, { tableName: "category", modelName: "Category", sequelize: sequelizeCon })

//product schema
class Product extends Model { }
Product.init({
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },
    productName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
        allowNull: false
    },
    slug: {
        type: DataTypes.STRING,
        unique: true
    },
    categoryID: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, { tableName: 'product', modelName: 'Product', sequelize: sequelizeCon });

// Define the association
Product.belongsTo(Category, { foreignKey: 'categoryID' });
Category.hasMany(Product, { foreignKey: 'categoryID' });

//post category
app.post('/category/add', async (req, res) => {
    let data = await Category.create(req.body).catch((error) => {
        return { error }
    })
    if (!data || (data && data.error)) {
        return res.send({ error: 'Failed to add the category' });
    }
    return res.send({ data })
})

//get all
app.get('/category/all', async (req, res) => {
    let data = await Category.findAll().catch((error) => {
        return { error }
    })
    if (!data || (data && data.error)) {
        return res.send({ error: 'Failed to get all the category' });
    }
    return res.send({ data })
})

//create slug
async function createSlug(name, count) {
    let slug = count > 0 ? `${name}-${count}` : name.toLowerCase().replace(/\s+/g, "-");
    let existSlug = await Product.findOne({ where: { slug } }).catch((error) => {
        return { error }
    })
    if (existSlug) {
        return createSlug(name, count + 1)
    }
    return slug;
}

//post product 
app.post('/product/add', async (req, res) => {
    let count = 0
    let uniqueSlug = await createSlug(req.body.productName, count).catch((error) => {
        return { error }
    })
    let userData = {
        productName: req.body.productName,
        description: req.body.description,
        price: req.body.price,
        categoryID: req.body.categoryID,
        slug: uniqueSlug              //no need to give slug
    }
    let data = await Product.create(userData).catch((error) => {
        return { error }
    })
    console.log("121 line", data)
    if (!data || (data && data.error)) {
        return res.send({ error: "failed to create the product" })
    }
    return res.send({ data })
})

//get product
app.get('/product/:getByHandle', async (req, res) => {             //slug  like(charger-1)
    let data = await Product.findOne({ where: { slug: req.params.getByHandle } }).catch((error) => {
        return { error }
    })
    // console.log(data);
    if (!data || (data && data.error)) {
        return res.send({ error: "Failed to get product" })
    }
    return res.send({ data })
})

//update product
app.put('/product/update/:productId', async (req, res) => {                       // instead of :productid 1,2,3,4,5,6 
    let findProduct = await Product.findOne({ where: { id: req.params.productId } }).catch((error) => {
        return { error: "cannot find this product" }
    })
    if (!findProduct || (findProduct && findProduct.error)) {
        return res.send({ error: "Cannot find product with given ID." });
    }
    let data = await Product.update(req.body, { where: { id: req.params.productId } }).catch((error) => {
        return { error }
    })
    if (!data || (data && data.error)) {
        return res.send({ error: "Failed to update product" })
    }
    return res.send({ data: "Product has been updated" })
})

//delete product
app.delete('/product/delete/:productId', async (req, res) => {             //id 1,2,3,4,5,6
    let findProduct = await Product.findOne({ where: { id: req.params.productId } }).catch((error) => {
        return { error: "cannot find this product" }  //req se data
    })                                                   //params se id
    if (!findProduct || (findProduct && findProduct.error)) {
        return res.send({ error: "Cannot find product with given ID." });
    }
    let data = await Product.destroy({ where: { id: req.params.productId } }).catch((error) => {
        return { error }
    })
    if (!data || (data && data.error)) {
        return res.send({ error: "Failed to delete product" })
    }
    return res.send({ data: "Product has been deleted" })
})

//get all with category
app.get('/product', async (req, res) => {
    let page = req.query.page ? parseInt(req.query.page) : 1; // this is page 
    let limit = req.query.limit ? parseInt(req.query.limit) : 5; //this is limit
    let offset = (page - 1) * limit; // this is offset
    let order = [['price', 'ASC']]; // this is sorting 
    if (req.query.sortBy) {
        let sortBy = req.query.sortBy; // this will take  the value from url query  here it  is price
        let sortOrder = req.query.sortOrder && req.query.sortOrder.toLowerCase() === 'desc' ? 'DESC' : 'ASC'; // sorting order
        order.unshift([sortBy, sortOrder]);
    }

    let whereCondition = {}; //this is for filter

    let result = await Product.findAndCountAll({
        where: whereCondition,
        include: [{
            model: Category,
            attributes: ['catName'],
            where: { id: Sequelize.col('product.categoryID') },
        }],
        order,
        limit,
        offset,
        raw: true,
    }).catch((error) => {
        return { error }
    })
    if (!result || (result && result.error)) {
        return res.send({ error: "Error while getting products." });
    }
    let total = result.count;
    let data = result.rows;

    return res.send({ data, total, page, limit });
});

//bulk create function
async function createBulkProducts(products) {
    let bulkData = [];

    for (let product of products) {
        let count = 0;
        let uniqueSlug = await createSlug(product.name, count).catch((error) => {
            return { error };
        });

        let userData = {
            productName: product.name,
            description: product.description,
            price: product.price,
            categoryID: product.categoryID,
            slug: uniqueSlug
        };

        bulkData.push(userData);
    }

    return await Product.bulkCreate(bulkData).catch((error) => {
        return { error };
    });
}
//bulk create api
app.post('/product/addProducts', async (req, res) => {
    let products = req.body.products;

    if (!Array.isArray(products) || products.length === 0) {
        return res.send({ error: "Invalid or empty product array" });
    }

    let result = await createBulkProducts(products).catch((error) => {
        return { error }
    })

    if (!result || (result && result.error)) {
        return res.send({ error: "Failed to create products" });
    }

    return res.send({ data: result });
});

app.listen(port, () => {
    console.log(`Server is running on ${port}`)
})


// parseint convert string to number