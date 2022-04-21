const express = require('express')
const mongoose = require("mongoose")

const app = express();
const PORT = 8080;

/*var DB = 'mongodb://root:password@127.0.0.1:27017/admin'
mongoose
  .connect(DB, {
    useNewUrlParser: true,
  })
  .then(() => console.log('DB connection successful!'))
  .catch(err => console.log(err));
  */
// create a schema
/*const studentSchema = new mongoose.Schema({
    name: String,
    subjects: [String]
});
*/
// create a model with studentSchema
// const Student = mongoose.model('Student', studentSchema);


// Create a new document
/*const stud = new Student({
    name: 'Madison Hyde',
    subjects: ['DBMS', 'OS', 'Graph Theory', 'Internet Programming']
});

*/

app.listen(PORT, ()=>{
	console.log('run on '+PORT);
})
app.get("/", async (req,res)=>{
	// await stud.save();
	res.send('One entry added')
})