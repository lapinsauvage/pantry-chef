"""Ingredient-name normalisation and ingredient-based classification.

`canonicalize("boneless skinless chicken breasts")` -> ["chicken breast"]
`canonicalize("salt and pepper")`                  -> ["salt", "black pepper"]

The canonical names are what the app's pantry picker shows and what
"what can I cook with what I have" matching runs on.
"""
from __future__ import annotations

import re
from functools import lru_cache
from urllib.parse import unquote

# Words that describe size/state/prep but don't change what you need to buy.
DESCRIPTORS = {
    "fresh", "freshly", "large", "extra", "extra-large", "medium", "small", "jumbo",
    "chopped", "minced", "diced", "sliced", "shredded", "grated", "crushed",
    "finely", "coarsely", "thinly", "roughly", "peeled", "cooked", "uncooked",
    "boneless", "skinless", "lean", "extra-lean", "organic", "ripe", "raw",
    "softened", "melted", "cold", "warm", "hot", "boiling", "room", "temperature",
    "frozen", "thawed", "dried", "dry", "whole", "pure", "real", "plain", "good",
    "quality", "store-bought", "homemade", "prepared", "packed", "firmly", "lightly",
    "loosely", "heaping", "level", "low-fat", "lowfat", "fat-free", "nonfat",
    "non-fat", "reduced-fat", "light", "lite", "low-sodium", "reduced-sodium",
    "unsalted", "salted", "sweetened", "unsweetened", "all-purpose", "granulated",
    "ground", "baby", "young", "mature", "sharp", "mild", "seedless", "pitted",
    "canned", "jarred", "bottled", "instant", "quick-cooking", "quick", "regular", "white",
    "reduced", "condensed", "miniature", "mini", "coarse", "coarsely-ground", "toasted",
    "roasted", "of", "a", "an", "about", "some", "additional", "optional", "kalamata",
}

# Descriptors that must NOT be stripped when they define the product.
KEEP_PHRASES = {
    "ground beef", "ground turkey", "ground pork", "ground chicken", "ground lamb",
    "white wine", "white vinegar", "white rice", "white bread", "white chocolate",
    "white beans", "white pepper", "white onion", "white wine vinegar",
    "dry white wine", "dry red wine", "dry mustard", "dry yeast", "light corn syrup",
    "light cream", "light rum", "hot sauce", "hot pepper sauce", "hot water",
    "quick oats", "old-fashioned oats", "whole wheat flour", "whole milk",
    "baby carrots", "baby spinach", "sweetened condensed milk",
    "instant coffee", "instant pudding", "instant rice", "cold water", "boiling water",
    "plain yogurt", "frozen peas", "dried cranberries", "dried apricots",
    "red pepper flakes", "crushed red pepper flakes", "crushed pineapple",
    "crushed tomatoes", "diced tomatoes", "sharp cheddar cheese",
}

# Explicit aliases applied after cleaning (cleaned -> canonical).
ALIASES = {
    "egg": "egg", "eggs": "egg", "egg white": "egg", "egg whites": "egg",
    "egg yolk": "egg", "egg yolks": "egg", "egg substitute": "egg",
    "garlic clove": "garlic", "garlic cloves": "garlic", "clove garlic": "garlic",
    "garlic powder": "garlic powder", "onions": "onion", "yellow onion": "onion",
    "white onion": "onion", "spanish onion": "onion", "sweet onion": "onion",
    "vidalia onion": "onion", "scallion": "green onion", "scallions": "green onion",
    "green onions": "green onion", "spring onion": "green onion", "spring onions": "green onion",
    "pepper": "black pepper", "black pepper": "black pepper", "fresh ground black pepper": "black pepper",
    "fresh ground pepper": "black pepper", "freshly ground pepper": "black pepper",
    "ground black pepper": "black pepper", "cracked black pepper": "black pepper",
    "peppercorns": "black pepper", "peppercorn": "black pepper",
    "kosher salt": "salt", "sea salt": "salt", "table salt": "salt", "coarse salt": "salt",
    "flour": "flour", "all-purpose flour": "flour", "plain flour": "flour", "white flour": "flour",
    "unbleached all-purpose flour": "flour", "unbleached flour": "flour", "bread flour": "flour",
    "self-rising flour": "self-raising flour", "self raising flour": "self-raising flour",
    "sugar": "sugar", "white sugar": "sugar", "granulated sugar": "sugar", "caster sugar": "sugar",
    "superfine sugar": "sugar", "light brown sugar": "brown sugar", "dark brown sugar": "brown sugar",
    "confectioners' sugar": "powdered sugar", "confectioners sugar": "powdered sugar",
    "icing sugar": "powdered sugar", "powdered sugar": "powdered sugar",
    "butter": "butter", "unsalted butter": "butter", "salted butter": "butter",
    "margarine": "margarine", "olive oil": "olive oil", "extra virgin olive oil": "olive oil",
    "extra-virgin olive oil": "olive oil", "virgin olive oil": "olive oil", "light olive oil": "olive oil",
    "oil": "vegetable oil", "vegetable oil": "vegetable oil", "canola oil": "vegetable oil",
    "cooking oil": "vegetable oil", "corn oil": "vegetable oil", "sunflower oil": "vegetable oil",
    "peanut oil": "peanut oil", "salad oil": "vegetable oil",
    "milk": "milk", "whole milk": "milk", "skim milk": "milk", "2% milk": "milk", "1% milk": "milk",
    "low-fat milk": "milk", "lowfat milk": "milk", "nonfat milk": "milk", "fat-free milk": "milk",
    "heavy cream": "cream", "whipping cream": "cream", "heavy whipping cream": "cream",
    "double cream": "cream", "single cream": "cream", "light cream": "cream", "cream": "cream",
    "half-and-half": "half-and-half", "half and half": "half-and-half",
    "parmesan cheese": "parmesan", "parmesan": "parmesan", "parmigiano-reggiano cheese": "parmesan",
    "parmigiano-reggiano": "parmesan", "romano cheese": "pecorino", "pecorino romano cheese": "pecorino",
    "cheddar cheese": "cheddar", "sharp cheddar cheese": "cheddar", "cheddar": "cheddar",
    "mild cheddar cheese": "cheddar", "extra-sharp cheddar cheese": "cheddar",
    "mozzarella cheese": "mozzarella", "part-skim mozzarella cheese": "mozzarella",
    "monterey jack cheese": "monterey jack", "swiss cheese": "swiss cheese",
    "feta cheese": "feta", "ricotta cheese": "ricotta", "part-skim ricotta cheese": "ricotta",
    "cream cheese": "cream cheese", "neufchatel cheese": "cream cheese",
    "cottage cheese": "cottage cheese", "goat cheese": "goat cheese",
    "plain yogurt": "yogurt", "yogurt": "yogurt", "greek yogurt": "yogurt", "vanilla yogurt": "yogurt",
    "plain nonfat yogurt": "yogurt", "nonfat yogurt": "yogurt",
    "vanilla": "vanilla extract", "vanilla extract": "vanilla extract", "pure vanilla extract": "vanilla extract",
    "cinnamon": "cinnamon", "ground cinnamon": "cinnamon", "cinnamon stick": "cinnamon",
    "cinnamon sticks": "cinnamon", "nutmeg": "nutmeg", "ground nutmeg": "nutmeg",
    "cumin": "cumin", "ground cumin": "cumin", "cumin seed": "cumin", "cumin seeds": "cumin",
    "ginger": "ginger", "fresh ginger": "ginger", "gingerroot": "ginger", "ginger root": "ginger",
    "fresh gingerroot": "ginger", "ground ginger": "ground ginger",
    "oregano": "oregano", "dried oregano": "oregano", "fresh oregano": "oregano",
    "basil": "basil", "fresh basil": "basil", "dried basil": "basil", "fresh basil leaves": "basil",
    "basil leaves": "basil", "thyme": "thyme", "dried thyme": "thyme", "fresh thyme": "thyme",
    "rosemary": "rosemary", "fresh rosemary": "rosemary", "dried rosemary": "rosemary",
    "parsley": "parsley", "fresh parsley": "parsley", "flat leaf parsley": "parsley",
    "fresh flat-leaf parsley": "parsley", "italian parsley": "parsley", "dried parsley": "parsley",
    "cilantro": "cilantro", "fresh cilantro": "cilantro", "coriander leaves": "cilantro",
    "fresh coriander": "cilantro", "dill": "dill", "fresh dill": "dill", "dill weed": "dill",
    "bay leaf": "bay leaf", "bay leaves": "bay leaf", "mint": "mint", "fresh mint": "mint",
    "mint leaves": "mint", "fresh mint leaves": "mint", "chives": "chives", "fresh chives": "chives",
    "tomatoes": "tomato", "tomato": "tomato", "roma tomatoes": "tomato", "plum tomatoes": "tomato",
    "cherry tomatoes": "cherry tomatoes", "grape tomatoes": "cherry tomatoes",
    "diced tomatoes": "canned tomatoes", "crushed tomatoes": "canned tomatoes",
    "stewed tomatoes": "canned tomatoes", "whole tomatoes": "canned tomatoes",
    "canned tomatoes": "canned tomatoes", "tomatoes with juice": "canned tomatoes",
    "potatoes": "potato", "potato": "potato", "russet potatoes": "potato", "red potatoes": "potato",
    "new potatoes": "potato", "yukon gold potatoes": "potato", "baking potatoes": "potato",
    "sweet potatoes": "sweet potato", "sweet potato": "sweet potato", "yams": "sweet potato",
    "carrots": "carrot", "carrot": "carrot", "baby carrots": "carrot",
    "celery": "celery", "celery ribs": "celery", "celery rib": "celery", "celery stalks": "celery",
    "celery stalk": "celery", "red bell pepper": "bell pepper", "green bell pepper": "bell pepper",
    "yellow bell pepper": "bell pepper", "bell pepper": "bell pepper", "bell peppers": "bell pepper",
    "green pepper": "bell pepper", "red pepper": "bell pepper", "green peppers": "bell pepper",
    "orange bell pepper": "bell pepper", "sweet red pepper": "bell pepper",
    "jalapeno": "jalapeno", "jalapenos": "jalapeno", "jalapeno pepper": "jalapeno",
    "jalapeno peppers": "jalapeno", "jalapeño": "jalapeno",
    "mushrooms": "mushroom", "mushroom": "mushroom", "button mushrooms": "mushroom",
    "white mushrooms": "mushroom", "fresh mushrooms": "mushroom", "cremini mushrooms": "mushroom",
    "lemon": "lemon", "lemons": "lemon", "lemon juice": "lemon juice", "fresh lemon juice": "lemon juice",
    "lemon zest": "lemon", "lemon rind": "lemon", "lime": "lime", "limes": "lime",
    "lime juice": "lime juice", "fresh lime juice": "lime juice", "lime zest": "lime",
    "orange": "orange", "oranges": "orange", "orange juice": "orange juice", "orange zest": "orange",
    "banana": "banana", "bananas": "banana", "apples": "apple", "apple": "apple",
    "granny smith apples": "apple", "chicken broth": "chicken broth", "chicken stock": "chicken broth",
    "low sodium chicken broth": "chicken broth", "chicken bouillon": "chicken broth",
    "chicken bouillon cube": "chicken broth", "chicken bouillon cubes": "chicken broth",
    "beef broth": "beef broth", "beef stock": "beef broth", "beef bouillon": "beef broth",
    "beef bouillon cube": "beef broth", "vegetable broth": "vegetable broth", "vegetable stock": "vegetable broth",
    "chicken breasts": "chicken breast", "chicken breast": "chicken breast",
    "boneless skinless chicken breasts": "chicken breast", "boneless skinless chicken breast": "chicken breast",
    "boneless chicken breasts": "chicken breast", "skinless chicken breasts": "chicken breast",
    "boneless skinless chicken breast halves": "chicken breast", "chicken breast halves": "chicken breast",
    "chicken thighs": "chicken thigh", "boneless skinless chicken thighs": "chicken thigh",
    "chicken": "chicken", "whole chicken": "chicken", "chicken pieces": "chicken",
    "cooked chicken": "chicken", "chicken meat": "chicken", "boneless chicken": "chicken",
    "lean ground beef": "ground beef", "extra lean ground beef": "ground beef",
    "hamburger": "ground beef", "ground chuck": "ground beef", "ground round": "ground beef",
    "bacon": "bacon", "bacon strips": "bacon", "slices bacon": "bacon",
    "shrimp": "shrimp", "large shrimp": "shrimp", "medium shrimp": "shrimp", "prawns": "shrimp",
    "salmon fillets": "salmon", "salmon fillet": "salmon", "salmon": "salmon",
    "rice": "rice", "long grain rice": "rice", "white rice": "rice", "long-grain rice": "rice",
    "long grain white rice": "rice", "basmati rice": "rice", "jasmine rice": "rice",
    "cooked rice": "rice", "instant rice": "rice", "brown rice": "brown rice",
    "spaghetti": "pasta", "penne": "pasta", "penne pasta": "pasta", "pasta": "pasta",
    "elbow macaroni": "pasta", "macaroni": "pasta", "linguine": "pasta", "fettuccine": "pasta",
    "egg noodles": "egg noodles", "lasagna noodles": "pasta", "rotini": "pasta", "rotini pasta": "pasta",
    "angel hair pasta": "pasta", "bow tie pasta": "pasta", "fusilli": "pasta", "rigatoni": "pasta",
    "breadcrumbs": "breadcrumbs", "dry breadcrumbs": "breadcrumbs", "bread crumbs": "breadcrumbs",
    "fresh breadcrumbs": "breadcrumbs", "panko breadcrumbs": "breadcrumbs", "seasoned breadcrumbs": "breadcrumbs",
    "baking powder": "baking powder", "baking soda": "baking soda", "bicarbonate of soda": "baking soda",
    "cornstarch": "cornstarch", "corn starch": "cornstarch", "cornflour": "cornstarch",
    "honey": "honey", "maple syrup": "maple syrup", "pure maple syrup": "maple syrup",
    "soy sauce": "soy sauce", "low sodium soy sauce": "soy sauce", "light soy sauce": "soy sauce",
    "dark soy sauce": "soy sauce", "tamari": "soy sauce",
    "mayonnaise": "mayonnaise", "light mayonnaise": "mayonnaise", "mayo": "mayonnaise",
    "ketchup": "ketchup", "catsup": "ketchup", "dijon mustard": "mustard", "mustard": "mustard",
    "prepared mustard": "mustard", "yellow mustard": "mustard", "dry mustard": "mustard powder",
    "worcestershire sauce": "worcestershire sauce", "hot sauce": "hot sauce",
    "hot pepper sauce": "hot sauce", "tabasco sauce": "hot sauce",
    "red pepper flakes": "chili flakes", "crushed red pepper flakes": "chili flakes",
    "crushed red pepper": "chili flakes", "dried red pepper flakes": "chili flakes",
    "cayenne pepper": "cayenne pepper", "cayenne": "cayenne pepper", "chili powder": "chili powder",
    "paprika": "paprika", "smoked paprika": "paprika", "sweet paprika": "paprika",
    "water": "water", "cold water": "water", "boiling water": "water", "hot water": "water",
    "warm water": "water", "ice water": "water", "ice cubes": "ice", "ice": "ice",
    "nonstick cooking spray": "cooking spray", "cooking spray": "cooking spray",
    "vegetable oil cooking spray": "cooking spray", "non-stick cooking spray": "cooking spray",
    "semi-sweet chocolate chips": "chocolate chips", "semisweet chocolate chips": "chocolate chips",
    "chocolate chips": "chocolate chips", "milk chocolate chips": "chocolate chips",
    "unsweetened cocoa powder": "cocoa powder", "cocoa powder": "cocoa powder", "cocoa": "cocoa powder",
    "pecans": "pecans", "pecan halves": "pecans", "chopped pecans": "pecans", "walnuts": "walnuts",
    "chopped walnuts": "walnuts", "walnut halves": "walnuts", "almonds": "almonds",
    "sliced almonds": "almonds", "slivered almonds": "almonds", "nuts": "nuts", "chopped nuts": "nuts",
    "peanut butter": "peanut butter", "creamy peanut butter": "peanut butter",
    "chunky peanut butter": "peanut butter", "peanuts": "peanuts",
    "raisins": "raisins", "golden raisins": "raisins", "black beans": "black beans",
    "kidney beans": "kidney beans", "red kidney beans": "kidney beans",
    "chickpeas": "chickpeas", "garbanzo beans": "chickpeas", "garbanzo bean": "chickpeas",
    "frozen peas": "peas", "peas": "peas", "green peas": "peas", "corn": "corn",
    "frozen corn": "corn", "whole kernel corn": "corn", "corn kernels": "corn",
    "green beans": "green beans", "fresh green beans": "green beans",
    "spinach": "spinach", "fresh spinach": "spinach", "baby spinach": "spinach",
    "frozen chopped spinach": "spinach", "frozen spinach": "spinach",
    "broccoli": "broccoli", "broccoli florets": "broccoli", "zucchini": "zucchini",
    "courgette": "zucchini", "eggplant": "eggplant", "aubergine": "eggplant",
    "cabbage": "cabbage", "green cabbage": "cabbage", "red cabbage": "cabbage",
    "cucumber": "cucumber", "cucumbers": "cucumber", "english cucumber": "cucumber",
    "avocado": "avocado", "avocados": "avocado", "red onion": "red onion", "red onions": "red onion",
    "shallot": "shallot", "shallots": "shallot", "leek": "leek", "leeks": "leek",
    "active dry yeast": "yeast", "dry yeast": "yeast", "yeast": "yeast", "instant yeast": "yeast",
    "quick-rise yeast": "yeast", "rolled oats": "oats", "oats": "oats", "quick oats": "oats",
    "old-fashioned oats": "oats", "quick-cooking oats": "oats", "old fashioned oats": "oats",
    "tomato paste": "tomato paste", "tomato sauce": "tomato sauce", "salsa": "salsa",
    "balsamic vinegar": "balsamic vinegar", "red wine vinegar": "red wine vinegar",
    "white wine vinegar": "white wine vinegar", "cider vinegar": "apple cider vinegar",
    "apple cider vinegar": "apple cider vinegar", "white vinegar": "vinegar", "vinegar": "vinegar",
    "rice vinegar": "rice vinegar", "rice wine vinegar": "rice vinegar",
    "dry white wine": "white wine", "white wine": "white wine", "dry red wine": "red wine",
    "red wine": "red wine", "sesame oil": "sesame oil", "toasted sesame oil": "sesame oil",
    "sesame seeds": "sesame seeds", "toasted sesame seeds": "sesame seeds",
    "sour cream": "sour cream", "light sour cream": "sour cream", "low-fat sour cream": "sour cream",
    "buttermilk": "buttermilk", "shortening": "shortening", "vegetable shortening": "shortening",
    "evaporated milk": "evaporated milk", "sweetened condensed milk": "condensed milk",
    "coconut milk": "coconut milk", "light coconut milk": "coconut milk",
    "tortillas": "tortillas", "flour tortillas": "tortillas", "corn tortillas": "corn tortillas",
    "bread": "bread", "white bread": "bread", "french bread": "bread", "bread slices": "bread",
    "garlic salt": "garlic salt", "onion powder": "onion powder", "curry powder": "curry powder",
    "allspice": "allspice", "ground allspice": "allspice", "cloves": "cloves", "ground cloves": "cloves",
    "whole cloves": "cloves", "clove": "cloves", "cardamom": "cardamom", "ground cardamom": "cardamom",
    "turmeric": "turmeric", "ground turmeric": "turmeric", "coriander": "ground coriander",
    "ground coriander": "ground coriander", "italian seasoning": "italian seasoning",
    "sage": "sage", "rubbed sage": "sage", "marjoram": "marjoram", "tarragon": "tarragon",
}

ALIASES.update({
    "hard-boiled egg": "egg", "hard-boiled eggs": "egg", "hard boiled eggs": "egg",
    "hard boiled egg": "egg", "half-and-half cream": "half-and-half",
    "breadcrumb": "breadcrumbs", "bread crumb": "breadcrumbs", "seasoned bread crumb": "breadcrumbs",
    "seasoned breadcrumb": "breadcrumbs", "italian seasoned breadcrumbs": "breadcrumbs",
    "italian breadcrumbs": "breadcrumbs", "panko": "breadcrumbs", "dark sesame oil": "sesame oil",
    "vanilla essence": "vanilla extract", "black peppercorn": "black pepper",
    "black peppercorns": "black pepper", "coarse ground black pepper": "black pepper",
    "ground pepper": "black pepper", "lemon peel": "lemon", "lemon wedge": "lemon",
    "lemon wedges": "lemon", "orange rind": "orange", "orange peel": "orange",
    "lime wedge": "lime", "lime wedges": "lime", "lime peel": "lime",
    "cream-style corn": "creamed corn", "cream style corn": "creamed corn",
    "cream of mushroom soup": "cream of mushroom soup", "cream of chicken soup": "cream of chicken soup",
    "cream of celery soup": "cream of celery soup", "chicken bouillon granule": "chicken broth",
    "chicken bouillon granules": "chicken broth", "beef bouillon granule": "beef broth",
    "beef bouillon granules": "beef broth", "splenda sugar substitute": "sweetener",
    "splenda granular": "sweetener", "splenda": "sweetener", "sugar substitute": "sweetener",
    "marshmallow": "marshmallows", "marshmallows": "marshmallows",
    "graham cracker crumb": "graham crackers", "graham cracker crumbs": "graham crackers",
    "graham crackers": "graham crackers", "taco seasoning mix": "taco seasoning",
    "sherry wine": "sherry", "dry sherry": "sherry", "ice cube": "ice", "ice cubes": "ice",
    "pesto sauce": "pesto", "pineapple chunk": "pineapple", "pineapple chunks": "pineapple",
    "crushed pineapple": "pineapple", "pineapple tidbits": "pineapple",
    "kalamata olive": "olives", "kalamata olives": "olives", "olive": "olives",
    "green chilies": "chili pepper", "green chiles": "chili pepper", "green chili": "chili pepper",
    "green chili pepper": "chili pepper", "green chili peppers": "chili pepper",
    "red chili pepper": "chili pepper", "red chili peppers": "chili pepper",
    "chili pepper": "chili pepper", "chili peppers": "chili pepper", "chilies": "chili pepper",
    "chiles": "chili pepper", "chile": "chili pepper", "chili": "chili pepper",
    "hot green chili peppers": "chili pepper", "green chili chiles": "chili pepper",
    "diced green chilies": "chili pepper", "serrano pepper": "chili pepper",
    "serrano chilies": "chili pepper", "thai chiles": "chili pepper",
    "parsley flakes": "parsley", "dried parsley flakes": "parsley",
    "cool whip": "whipped topping", "whipped topping": "whipped topping",
    "frozen whipped topping": "whipped topping", "cool whip free": "whipped topping",
    "soymilk": "soy milk", "soy milk": "soy milk", "old bay seasoning": "old bay seasoning",
    "roasting chicken": "chicken", "fryer chicken": "chicken", "broiler-fryer chicken": "chicken",
    "chicken thigh": "chicken thigh", "spaghetti sauce": "pasta sauce", "pasta sauce": "pasta sauce",
    "marinara sauce": "pasta sauce", "prepared spaghetti sauce": "pasta sauce",
    "italian salad dressing": "italian dressing", "italian dressing": "italian dressing",
    "semisweet chocolate": "chocolate", "semi-sweet chocolate": "chocolate",
    "bittersweet chocolate": "chocolate", "baking chocolate": "chocolate",
    "unsweetened chocolate": "chocolate", "dark chocolate": "chocolate",
    "chocolate": "chocolate", "milk chocolate": "chocolate", "baking cocoa": "cocoa powder",
    "unsweetened baking cocoa": "cocoa powder", "vanilla instant pudding mix": "vanilla pudding mix",
    "vanilla instant pudding": "vanilla pudding mix", "vanilla pudding": "vanilla pudding mix",
    "instant vanilla pudding": "vanilla pudding mix", "low-fat milk": "milk",
    "vegetable broth": "vegetable broth", "chicken wing": "chicken wings",
    "chicken wings": "chicken wings", "flaked coconut": "coconut", "shredded coconut": "coconut",
    "sweetened flaked coconut": "coconut", "sweetened shredded coconut": "coconut",
    "coconut": "coconut", "date": "dates", "dates": "dates", "pitted dates": "dates",
    "orzo pasta": "orzo", "cashew": "cashews", "cashews": "cashews", "cashew nuts": "cashews",
    "salt free seasoning": "seasoning", "mrs. dash seasoning mix": "seasoning",
    "lemon zest": "lemon", "lemons, juice of": "lemon juice", "lemon, juice of": "lemon juice",
    "lime, juice of": "lime juice", "limes, juice of": "lime juice", "orange, juice of": "orange juice",
    "mozzarella": "mozzarella", "provolone": "provolone", "provolone cheese": "provolone",
    "gruyere cheese": "gruyere", "gruyere": "gruyere", "blue cheese": "blue cheese",
    "crumbled blue cheese": "blue cheese", "velveeta cheese": "velveeta",
    "american cheese": "american cheese", "monterey jack pepper cheese": "monterey jack",
    "pepper jack cheese": "monterey jack", "colby-monterey jack cheese": "monterey jack",
    "mexican blend cheese": "cheese", "shredded mexican cheese blend": "cheese",
    "italian cheese blend": "cheese", "pork chops": "pork chop", "beef stew meat": "stewing beef",
    "stewing beef": "stewing beef", "beef chuck": "stewing beef",
    "fresh mushroom": "mushroom", "portabella mushroom": "mushroom", "portobello mushroom": "mushroom",
    "baby bella mushroom": "mushroom", "shiitake mushroom": "shiitake mushroom",
    "yellow squash": "summer squash", "summer squash": "summer squash",
    "romaine lettuce": "lettuce", "iceberg lettuce": "lettuce", "lettuce leaf": "lettuce",
    "lettuce leaves": "lettuce", "mixed greens": "salad greens", "salad greens": "salad greens",
    "spring mix": "salad greens", "golden raisin": "raisins", "golden raisins": "raisins",
    "dried cranberry": "dried cranberries", "craisins": "dried cranberries",
    "fresh cranberries": "cranberries", "cranberry": "cranberries",
    "strawberry": "strawberries", "strawberries": "strawberries", "blueberry": "blueberries",
    "raspberry": "raspberries", "cherry": "cherries", "maraschino cherry": "maraschino cherries",
    "maraschino cherries": "maraschino cherries", "tilapia fillet": "tilapia",
    "tilapia fillets": "tilapia", "fish fillet": "white fish", "fish fillets": "white fish",
    "white fish fillets": "white fish", "cod fillets": "cod", "cod fillet": "cod",
    "orange marmalade": "marmalade", "red food coloring": "food coloring",
    "food coloring": "food coloring", "green food coloring": "food coloring",
    "chicken bouillon": "chicken broth", "chicken bouillon powder": "chicken broth",
})

ALIASES.update({
    "hot dog": "hot dogs", "hot dogs": "hot dogs", "frankfurter": "hot dogs", "frankfurters": "hot dogs",
    "rice krispy": "rice krispies", "rice krispies": "rice krispies", "rice krispies cereal": "rice krispies",
    "soya sauce": "soy sauce", "chocolate chip": "chocolate chips", "cumin powder": "cumin",
    "turmeric powder": "turmeric", "coriander powder": "ground coriander", "red chili powder": "chili powder",
    "chili pepper flakes": "chili flakes", "red chili pepper flakes": "chili flakes",
    "red chili": "chili pepper", "red chilies": "chili pepper", "cauliflower floret": "cauliflower",
    "cauliflower florets": "cauliflower", "broccoli floret": "broccoli", "asparagus spear": "asparagus",
    "asparagus spears": "asparagus", "lemon slice": "lemon", "lemon slices": "lemon",
    "yellow pepper": "bell pepper", "yellow peppers": "bell pepper", "sun-dried tomato": "sun-dried tomatoes",
    "sun-dried tomatoes": "sun-dried tomatoes", "sun dried tomatoes": "sun-dried tomatoes",
    "hash brown": "hash browns", "hash browns": "hash browns", "hash brown potatoes": "hash browns",
    "frozen hash browns": "hash browns", "bisquick baking mix": "bisquick", "pork loin chop": "pork chop",
    "pork loin chops": "pork chop", "sirloin": "sirloin steak", "sirloin steak": "sirloin steak",
    "smooth peanut butter": "peanut butter", "dijon-style mustard": "mustard", "grain mustard": "mustard",
    "whole grain mustard": "mustard", "spicy brown mustard": "mustard", "wide egg noodles": "egg noodles",
    "shell pasta": "pasta", "pasta shell": "pasta", "pasta shells": "pasta", "ziti pasta": "pasta",
    "ziti": "pasta", "farfalle": "pasta", "tuna in water": "tuna", "canned tuna": "tuna",
    "solid white tuna": "tuna", "coffee granule": "instant coffee", "coffee granules": "instant coffee",
    "instant coffee granules": "instant coffee", "brewed coffee": "coffee", "strong coffee": "coffee",
    "milk powder": "milk powder", "powdered milk": "milk powder", "nonfat dry milk powder": "milk powder",
    "mashed banana": "banana", "mashed bananas": "banana", "granny smith apple": "apple",
    "tart apple": "apple", "tart apples": "apple", "chorizo sausage": "chorizo", "deli ham": "ham",
    "cooked ham": "ham", "soft breadcrumbs": "breadcrumbs", "rotel tomatoes": "canned tomatoes",
    "tomatoes and green chili": "canned tomatoes", "tomatoes and green chilies": "canned tomatoes",
    "cannellini beans": "white beans", "great northern beans": "white beans", "navy beans": "white beans",
    "pork sausage": "sausage", "bulk pork sausage": "sausage", "breakfast sausage": "sausage",
    "smoked sausage": "sausage", "sausages": "sausage", "lemon pepper seasoning": "lemon pepper",
    "brie cheese": "brie", "asiago cheese": "asiago", "goat cheese": "goat cheese",
    "chevre": "goat cheese", "feta": "feta", "bacon bit": "bacon bits", "bacon bits": "bacon bits",
    "unflavored gelatin": "gelatin", "gelatin": "gelatin", "knox gelatin": "gelatin",
    "graham cracker crust": "pie crust", "pie shell": "pie crust", "unbaked pie shell": "pie crust",
    "pastry for single-crust pie": "pie crust", "refrigerated pie crust": "pie crust",
    "wonton wrapper": "wonton wrappers", "saltine crackers": "crackers", "saltine cracker": "crackers",
    "ritz crackers": "crackers", "english muffin": "english muffins", "vanilla wafer": "vanilla wafers",
    "pretzel": "pretzels", "baguette": "baguette", "french baguette": "baguette",
    "red potato": "potato", "yukon gold potato": "potato", "baking potato": "potato",
    "russet potato": "potato", "new potato": "potato", "idaho potato": "potato",
})

LEAF_KEEP = {"bay", "lime", "curry", "kaffir", "kaffir lime", "banana", "grape", "lettuce",
             "cabbage", "nori", "phyllo"}
_PERCENT = re.compile(r"\b\d+(?:\.\d+)?\s*%")
_FAT_WORDS = re.compile(r"\b(?:low|reduced|non|no)[- ]?(?:fat|sodium|sugar|calorie)\b|"
                        r"\bfat[- ]free\b|\bsugar[- ]free\b|\blow[- ]fat\b")

# Compound entries split into several canonical ingredients.
SPLITS = {
    "salt and pepper": ["salt", "black pepper"],
    "salt & pepper": ["salt", "black pepper"],
    "salt & freshly ground black pepper": ["salt", "black pepper"],
    "salt and freshly ground black pepper": ["salt", "black pepper"],
    "salt and black pepper": ["salt", "black pepper"],
    "salt & fresh ground pepper": ["salt", "black pepper"],
    "salt and fresh ground pepper": ["salt", "black pepper"],
    "salt and pepper, to taste": ["salt", "black pepper"],
}

# Never counted as "missing" — everyone has them.
HARD_STAPLES = {"water", "salt", "black pepper", "ice", "cooking spray"}

# Suggested "basics I always have" (user can edit in the app).
DEFAULT_BASICS = [
    "water", "salt", "black pepper", "vegetable oil", "olive oil", "sugar", "flour",
    "butter", "garlic", "onion", "egg", "milk",
]

_NON_ALPHA = re.compile(r"[^a-z0-9%&'\- ]+")
_SPACES = re.compile(r"\s+")


def _singular(word: str) -> str:
    if len(word) <= 3 or word in {"asparagus", "hummus", "couscous", "molasses", "swiss",
                                  "brussels", "grits", "oats", "lentils", "chickpeas",
                                  "peas", "noodles", "greens", "chives", "raisins",
                                  "pecans", "walnuts", "almonds", "nuts", "peanuts",
                                  "cloves", "sesame", "cookies", "crackers", "tortillas",
                                  "breadcrumbs", "flakes", "chips", "beans", "sprouts",
                                  "capers", "olives", "anchovies", "oysters", "clams",
                                  "mussels", "scallops", "berries", "cranberries",
                                  "blueberries", "raspberries", "strawberries", "cherries",
                                  "tomatoes", "potatoes", "glass", "bass", "citrus",
                                  "hummus", "series", "jus", "syrup", "species"}:
        return word
    if word in {"leaves"}:
        return "leaf"
    if word in {"chilies", "chillies"}:
        return "chili"
    if word.endswith("ies") and len(word) > 4:
        return word[:-3] + "y"
    if word.endswith("oes"):
        return word[:-2]
    if word.endswith(("ches", "shes", "sses", "xes")):
        return word[:-2]
    if word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def clean_name(raw: str) -> str:
    s = unquote(raw).lower().strip()
    s = s.replace("&amp;", "&")
    s = re.sub(r"\([^)]*\)", " ", s)
    s = s.split(",")[0]
    s = _PERCENT.sub(" ", s)
    s = _FAT_WORDS.sub(" ", s)
    s = s.replace("–", "-").replace("—", "-")
    s = _NON_ALPHA.sub(" ", s)
    s = _SPACES.sub(" ", s).strip(" -")
    return s


@lru_cache(maxsize=100_000)
def canonicalize(raw: str) -> tuple[str, ...]:
    """Return one or more canonical ingredient names for a raw ingredient name."""
    s = clean_name(raw)
    if not s:
        return ()
    if s in SPLITS:
        return tuple(SPLITS[s])
    if s in ALIASES:
        return (ALIASES[s],)
    if " or " in s:  # "cilantro or mint" -> first option counts
        return canonicalize(s.split(" or ")[0])
    if s not in KEEP_PHRASES:
        words = s.split()
        # strip leading descriptors, keep at least one word
        while len(words) > 1 and words[0] in DESCRIPTORS:
            candidate = " ".join(words)
            if candidate in KEEP_PHRASES:
                break
            words = words[1:]
        s = " ".join(words)
    if s in ALIASES:
        return (ALIASES[s],)
    words = s.split()
    words[-1] = _singular(words[-1])
    if len(words) > 1 and words[-1] == "leaf" and " ".join(words[:-1]) not in LEAF_KEEP:
        words = words[:-1]
    if len(words) > 1 and words[-1] in {"fillet", "steaks"}:
        words = words[:-1]
    s = " ".join(words)
    if s in ALIASES:
        return (ALIASES[s],)
    return (s,)


# --------------------------------------------------------------------------
# Ingredient-based flags. Patterns run on canonical names with word boundaries.

def _rx(*words: str) -> re.Pattern:
    return re.compile(r"\b(?:" + "|".join(words) + r")\b")

MEAT = _rx("beef", "steak", "pork", "bacon", "ham", "sausages?", "chorizo", "pepperoni",
           "salami", "prosciutto", "pancetta", "chicken", "turkey", "duck", "lamb", "veal",
           "venison", "goose", "meat", "meatballs?", "hamburger", "hot dogs?", "frankfurters?",
           "bratwurst", "kielbasa", "lard", "suet", "ribs", "brisket", "gelatin", "gelatine",
           "jell-o", "jello", "bouillon", "drippings", "rabbit", "liver", "giblets", "bison",
           "corned", "pastrami", "roast beef", "spam", "andouille")
FISH = _rx("fish", "salmon", "tuna", "cod", "tilapia", "halibut", "trout", "anchov(?:y|ies)",
           "sardines?", "mackerel", "haddock", "catfish", "sole", "flounder", "snapper", "bass",
           "swordfish", "mahi", "fish sauce", "worcestershire sauce", "caesar dressing",
           "orange roughy", "pollock", "herring", "caviar", "roe", "bonito", "dashi")
SHELLFISH = _rx("shrimp", "prawns?", "crab", "crabmeat", "lobster", "scallops?", "clams?",
                "mussels?", "oysters?", "crawfish", "crayfish", "squid", "calamari", "octopus",
                "langoustines?")
EGG = _rx("eggs?", "egg whites?", "egg yolks?", "mayonnaise", "meringue", "eggnog",
          "egg noodles", "egg substitute")
_DAIRY_EXCEPT = re.compile(r"\b(peanut|almond|apple|cocoa|cashew|sunflower|nut|shea|soy|"
                           r"coconut|oat|rice|vegan|non-dairy|nondairy|dairy-free)\s+"
                           r"(butter|milk|cream|cheese|yogurt|creamer)\b|cream of tartar|"
                           r"butternut|creamed corn|cream style corn")
DAIRY = _rx("milk", "butter", "buttermilk", "cheese", "cheddar", "parmesan", "pecorino",
            "mozzarella", "ricotta", "feta", "mascarpone", "brie", "gouda", "gruyere",
            "monterey jack", "colby", "provolone", "cream", "half-and-half", "yogurt", "ghee",
            "whey", "custard", "kefir", "ice cream", "sour cream", "creme fraiche", "queso",
            "paneer", "condensed milk", "evaporated milk", "velveeta", "swiss cheese")
_GLUTEN_EXCEPT = re.compile(r"\b(almond|coconut|rice|corn|chickpea|garbanzo|tapioca|potato|"
                            r"buckwheat|oat|sorghum|millet|gluten-free|gluten free|cassava)\s+"
                            r"(flour|noodles|pasta|bread|tortillas?|crackers)\b|rice noodles|"
                            r"corn tortillas?|buckwheat|cornstarch|gluten-free")
GLUTEN = _rx("flour", "self-raising flour", "bread", "breadcrumbs", "panko", "pasta",
             "spaghetti", "macaroni", "noodles", "couscous", "bulgur", "barley", "rye",
             "wheat", "semolina", "tortillas?", "pie crusts?", "pie shells?", "pastry",
             "crackers?", "cookies?", "cake mix", "biscuits?", "soy sauce", "beer", "ale",
             "seitan", "croutons", "graham crackers?", "pretzels?", "oats", "farro", "spelt",
             "malt", "bagels?", "buns?", "rolls", "pita", "croissants?", "stuffing mix",
             "teriyaki sauce", "hoisin sauce", "brownie mix", "bisquick", "baking mix",
             "puff pastry", "phyllo", "filo", "wonton wrappers?", "egg roll wrappers?",
             "pizza dough", "lasagna", "ravioli", "tortellini", "gnocchi", "orzo", "matzo")
TREE_NUTS = _rx("almonds?", "walnuts?", "pecans?", "cashews?", "pistachios?", "hazelnuts?",
                "macadamia", "brazil nuts?", "pine nuts?", "nuts", "praline", "marzipan",
                "nutella", "almond butter", "almond milk", "almond extract", "amaretto",
                "frangelico", "almond flour")
PEANUT = _rx("peanuts?", "peanut butter", "peanut oil")
SOY = _rx("soy", "soy sauce", "tofu", "tempeh", "edamame", "miso", "soybeans?", "tamari",
          "teriyaki sauce", "soy milk", "hoisin sauce")
SESAME = _rx("sesame", "sesame oil", "sesame seeds?", "tahini", "hummus")
PORK = _rx("pork", "bacon", "ham", "sausages?", "pepperoni", "salami", "prosciutto",
           "pancetta", "chorizo", "lard", "hot dogs?", "bratwurst", "kielbasa", "andouille",
           "spam")
ALCOHOL = _rx("wine", "beer", "ale", "rum", "vodka", "whiskey", "whisky", "bourbon", "brandy",
              "liqueur", "sherry", "tequila", "gin", "champagne", "cognac", "kahlua", "amaretto",
              "marsala", "sake", "mirin", "triple sec", "grand marnier", "schnapps", "vermouth",
              "port", "cointreau", "baileys", "irish cream", "creme de", "lager", "stout",
              "prosecco", "cider")
HONEY = _rx("honey")

# Bit values are shared with the app (see shared/constants.json).
AVOID_BITS = {
    "gluten": 1, "dairy": 2, "egg": 4, "tree_nuts": 8, "peanut": 16, "fish": 32,
    "shellfish": 64, "soy": 128, "sesame": 256, "pork": 512, "alcohol": 1024, "meat": 2048,
    "honey": 4096,
}


def avoid_mask(name: str) -> int:
    """Bitmask of AVOID_BITS that this canonical ingredient triggers."""
    m = 0
    if GLUTEN.search(name) and not _GLUTEN_EXCEPT.search(name):
        m |= AVOID_BITS["gluten"]
    if DAIRY.search(name) and not _DAIRY_EXCEPT.search(name):
        m |= AVOID_BITS["dairy"]
    if EGG.search(name) and "eggplant" not in name:
        m |= AVOID_BITS["egg"]
    if TREE_NUTS.search(name) and "nutmeg" not in name and "coconut" not in name:
        m |= AVOID_BITS["tree_nuts"]
    if PEANUT.search(name):
        m |= AVOID_BITS["peanut"]
    if FISH.search(name):
        m |= AVOID_BITS["fish"]
    if SHELLFISH.search(name):
        m |= AVOID_BITS["shellfish"]
    if SOY.search(name):
        m |= AVOID_BITS["soy"]
    if SESAME.search(name):
        m |= AVOID_BITS["sesame"]
    if PORK.search(name) and "pork rind" not in name:
        m |= AVOID_BITS["pork"]
    if ALCOHOL.search(name) and not re.search(r"vinegar|cider vinegar|wine vinegar|port-?salut|"
                                              r"rum extract|apple cider\b(?! vinegar)", name):
        m |= AVOID_BITS["alcohol"]
    if MEAT.search(name) and not re.search(r"vegetable bouillon|vegetarian|veggie|meatless|"
                                           r"imitation|soy", name):
        m |= AVOID_BITS["meat"]
    if HONEY.search(name) and "honeydew" not in name:
        m |= AVOID_BITS["honey"]
    return m


# Coarse grocery category for the pantry picker.
CATEGORIES = ["produce", "meat", "fish", "dairy_eggs", "grains_bakery", "canned_jarred",
              "spices_herbs", "baking_sweets", "other"]
_GRAINS = re.compile(r"\b(flour|rice|pasta|bread|noodles|oats|oatmeal|tortillas?|couscous|quinoa|"
                     r"cornmeal|breadcrumbs|crackers?|barley|polenta|bulgur|orzo|spaghetti|"
                     r"macaroni|lasagna|buns?|rolls?|pita|bagels?|croissants?|cereal|granola|"
                     r"pie crusts?|puff pastry|phyllo|wonton wrappers?|graham crackers|cornflakes|"
                     r"corn flakes|bisquick|baking mix|cake mix)\b")
_SPICES = re.compile(r"\b(cinnamon|nutmeg|cumin|paprika|oregano|basil|thyme|rosemary|parsley|"
                     r"cilantro|dill|bay leaf|mint|chives|ginger|cloves|cardamom|turmeric|"
                     r"coriander|sage|marjoram|tarragon|allspice|chili flakes|chili powder|curry|"
                     r"cayenne|seasoning|powder|saffron|fennel seeds?|mustard seeds?|vanilla|"
                     r"black pepper|white pepper|salt|herbs?|garam masala|spice|peppercorns?|"
                     r"celery seed|caraway|poppy seeds?|sesame seeds|anise|lemongrass)\b")
_BAKING = re.compile(r"\b(sugar|baking soda|baking powder|yeast|cocoa|chocolate|cornstarch|gelatin|"
                     r"sprinkles|marshmallows|extract|shortening|raisins|nuts|pecans|walnuts|"
                     r"almonds|cashews|pistachios|hazelnuts|pine nuts|coconut(?! milk| cream)|cream of tartar|"
                     r"food coloring|chips|sweetener|molasses|corn syrup|dates|dried cranberries|"
                     r"pudding mix|whipped topping|frosting|icing)\b")
_CANNED = re.compile(r"\b(canned|beans|broth|stock|sauce|paste|salsa|soup|ketchup|mustard|"
                     r"mayonnaise|vinegar|oil|syrup|honey|jam|jelly|peanut butter|olives|"
                     r"pickles?|capers|coconut milk|almond milk|soy milk|oat milk|dressing|"
                     r"condensed milk|evaporated milk|chickpeas|lentils|tomato puree|pesto|"
                     r"marmalade|preserves|bouillon|relish|horseradish|wine|beer|liqueur|rum|"
                     r"vodka|brandy|sherry|juice|tuna|water chestnuts?|chutney)\b")
_PRODUCE = re.compile(r"\b(onions?|garlic|tomato(?:es)?|potato(?:es)?|carrots?|celery|peppers?|"
                      r"jalapenos?|mushrooms?|lemons?|limes?|oranges?|bananas?|apples?|spinach|"
                      r"broccoli|zucchini|eggplant|cabbage|cucumbers?|avocados?|shallots?|leeks?|"
                      r"lettuce|kale|corn|peas|green beans|berr(?:y|ies)|\w+berries|cherr(?:y|ies)|"
                      r"peach(?:es)?|pears?|grapes?|mango(?:es)?|pineapple|squash|pumpkin|"
                      r"cauliflower|asparagus|radish(?:es)?|beets?|melon|plums?|apricots?|figs?|"
                      r"kiwi|scallions?|chiles?|chili pepper|greens|sprouts|artichokes?|fennel|"
                      r"parsnips?|turnips?|okra|rhubarb|tomatillos?|ginger|herbs)\b")


def category(name: str) -> str:
    m = avoid_mask(name)
    if _GRAINS.search(name) and not re.search(r"\bbread(?:ed)? \w+|rice vinegar|rice wine", name):
        return "grains_bakery"
    if m & AVOID_BITS["meat"] and not re.search(r"broth|stock|bouillon|gelatin|jell-?o|soup|gravy",
                                                name):
        return "meat"
    if m & (AVOID_BITS["fish"] | AVOID_BITS["shellfish"]) and not re.search(r"sauce|dressing|paste",
                                                                            name):
        return "fish"
    if _SPICES.search(name) and not re.search(r"ginger ale|fresh ginger|garlic$", name):
        return "spices_herbs"
    if _BAKING.search(name):
        return "baking_sweets"
    if _CANNED.search(name):
        return "canned_jarred"
    if m & (AVOID_BITS["dairy"] | AVOID_BITS["egg"]):
        return "dairy_eggs"
    if _PRODUCE.search(name):
        return "produce"
    return "other"
