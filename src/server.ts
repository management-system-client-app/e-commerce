const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(router);

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});